import type { DeviceFaultProfile } from "../deviceFaults";

/**
 * Pilz PNOZ s3 and PNOZ X2.8P safety relay fault profiles, from the Pilz operating manuals (LED tables and
 * wiring diagrams read from the manual page images). Readings derived from a stated circuit voltage say so in their note.
 */
export const PILZ_FAULTS: DeviceFaultProfile[] = [
  {
    "id": "pilz-pnoz-s3",
    "title": "Pilz PNOZ s3 (PNOZsigma) safety relay, 24 VDC, 2 N/O + 1 semiconductor output",
    "match": {
      "categories": [
        "safetyRelay"
      ],
      "manufacturer": "Pilz",
      "family": "PNOZ s3"
    },
    "normal": [
      {
        "terminals": "A1 (+) to A2 (-)",
        "state": "powered",
        "meter": "VDC",
        "pins": [
          [
            "A1",
            "A2"
          ]
        ],
        "expected": "24 VDC, tolerance -15 %/+10 % (20.4-26.4 VDC); residual ripple max. 20 %",
        "note": "Technical details p. 21. Supply must be SELV/PELV. POWER LED permanently lit = ready for operation."
      },
      {
        "terminals": "S34 to A2",
        "state": "start circuit closed (START LED on)",
        "meter": "VDC",
        "pins": [
          [
            "S34",
            "A2"
          ]
        ],
        "expected": "approx. 24 VDC ('24 VDC is present at S34')",
        "note": "Status indicators p. 18; start circuit voltage DC 24 V (Technical details p. 21). Start button / feedback loop are wired S12-S34."
      },
      {
        "terminals": "S12 to A2, S22 to A2",
        "state": "input circuit closed (IN1 / IN2 LED on)",
        "meter": "VDC",
        "pins": [
          [
            "S12",
            "A2"
          ],
          [
            "S22",
            "A2"
          ]
        ],
        "expected": "approx. 24 VDC (input circuit voltage DC 24 V, 50 mA)",
        "note": "IN1 = input circuit at S12 closed, IN2 = input circuit at S22 closed (p. 18). The 24 V figure is the published input-circuit voltage (p. 21), not a stated test point; with an ESPE/OSSD sensor S12/S22 are driven by the sensor outputs."
      },
      {
        "terminals": "13-14, 23-24",
        "state": "unit active (OUT LED on)",
        "meter": "continuity",
        "pins": [
          [
            "13",
            "14"
          ],
          [
            "23",
            "24"
          ]
        ],
        "expected": "closed (positive-guided N/O safety contacts)"
      },
      {
        "terminals": "13-14, 23-24",
        "state": "input circuit open, power off or fault (OUT LED off)",
        "meter": "continuity",
        "pins": [
          [
            "13",
            "14"
          ],
          [
            "23",
            "24"
          ]
        ],
        "expected": "open"
      },
      {
        "terminals": "Y32 to A2",
        "state": "unit active (OUT LED on)",
        "meter": "VDC",
        "pins": [
          [
            "Y32",
            "A2"
          ]
        ],
        "expected": "high signal, approx. 24 VDC (semiconductor output 24 V, max. 20 mA; max. internal voltage drop 5 V)",
        "note": "Auxiliary output only (e.g. for display) - must not be used for safety circuits (Wiring p. 11). Residual current at '0' signal 0.1 mA."
      },
      {
        "terminals": "input circuit loop (S11-S12 / S21-S22 with E-STOP released)",
        "state": "power off, wiring disconnected from the unit",
        "meter": "ohms",
        "pins": [
          [
            "S11",
            "S12"
          ],
          [
            "S21",
            "S22"
          ]
        ],
        "expected": "<= 30 Ohm total cable resistance (single-channel, or dual-channel with detection of shorts across contacts); <= 60 Ohm dual-channel without detection",
        "note": "Max. overall cable resistance Rlmax, Technical details p. 21. Dual-channel without detection of shorts is wired S11-S12 and S11-S22 (Connection p. 13)."
      }
    ],
    "pairs": [
      {
        "a": "13",
        "b": "14",
        "when": "safety OK",
        "note": "Safety contacts closed when OUT LED is lit (p. 18)."
      },
      {
        "a": "23",
        "b": "24",
        "when": "safety OK",
        "note": "Safety contacts closed when OUT LED is lit (p. 18)."
      }
    ],
    "indicators": [
      {
        "name": "POWER",
        "state": "on",
        "meaning": "Supply voltage is present; unit ready for operation when permanently lit"
      },
      {
        "name": "IN1",
        "state": "on",
        "meaning": "Input circuit at S12 is closed"
      },
      {
        "name": "IN2",
        "state": "on",
        "meaning": "Input circuit at S22 is closed"
      },
      {
        "name": "OUT",
        "state": "on",
        "meaning": "Safety contacts are closed and semiconductor output Y32 carries a high signal"
      },
      {
        "name": "START",
        "state": "on",
        "meaning": "24 VDC is present at S34"
      },
      {
        "name": "All LEDs",
        "state": "off",
        "meaning": "Short across contacts / earth fault; unit switched off"
      },
      {
        "name": "FAULT",
        "state": "on",
        "meaning": "Plug terminator not connected"
      },
      {
        "name": "FAULT",
        "state": "flashes",
        "meaning": "Internal error, unit defective"
      },
      {
        "name": "POWER",
        "state": "flashes",
        "meaning": "Supply voltage too low"
      },
      {
        "name": "IN1, IN2 + FAULT",
        "state": "IN1, IN2 flash alternately, FAULT on",
        "meaning": "Connection error (possibly cable resistance in the input circuit too high) or short detected between S12 and S22"
      },
      {
        "name": "IN1 + FAULT",
        "state": "IN1 flashes, FAULT on",
        "meaning": "Power-up blocked due to short-term interruption at S12; channels in the input circuit not opened simultaneously"
      },
      {
        "name": "IN2 + FAULT",
        "state": "IN2 flashes, FAULT on",
        "meaning": "Power-up blocked due to short-term interruption at S22; channels in the input circuit not opened simultaneously"
      },
      {
        "name": "IN1, IN2 + FAULT",
        "state": "IN1, IN2 flash simultaneously, FAULT on",
        "meaning": "Power-up blocked due to short-term interruption at S12 and S22; channels in the input circuit not opened simultaneously"
      },
      {
        "name": "START + FAULT",
        "state": "START flashes, FAULT on",
        "meaning": "Position of rotary switch is not permitted or rotary switch was adjusted during operation"
      },
      {
        "name": "POWER, IN1, IN2, OUT, START, FAULT",
        "state": "all on",
        "meaning": "Operating mode selector switch 'mode' is in its start position (vertical position)"
      }
    ],
    "faults": [
      {
        "title": "No supply voltage",
        "symptom": "POWER LED off, safety contacts 13-14 / 23-24 open",
        "causes": [
          "No 24 VDC at A1/A2 (upstream fuse/breaker, wiring)"
        ],
        "confirm": [
          "Measure A1 to A2: must be 20.4-26.4 VDC (24 VDC -15 %/+10 %). 0 V means the supply side is open."
        ],
        "fix": [
          "Restore the 24 VDC SELV/PELV supply to A1(+)/A2(-)."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_s3_Operat_Man_21395-EN-19.pdf (Status indicators p. 18; Technical details p. 21; Connection p. 13)"
      },
      {
        "title": "Short across contacts / earth fault - unit switched off",
        "symptom": "All LEDs off although supply is connected; safety contacts open",
        "causes": [
          "Short across contacts in the input circuit (e.g. S11/S21 path shorted to S12/S22)",
          "Earth fault in the start or input circuit"
        ],
        "confirm": [
          "With 20.4-26.4 VDC present at A1-A2 and every LED off, the unit has switched itself off on a short across contacts / earth fault.",
          "Power off, unplug the input terminals and check the input/start wiring for shorts between channels and to earth with an ohmmeter."
        ],
        "fix": [
          "Rectify the short across contacts / earth fault, then switch off the supply voltage for 1 min before switching on again."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_s3_Operat_Man_21395-EN-19.pdf (Error indicators p. 19)"
      },
      {
        "title": "Supply voltage too low",
        "symptom": "POWER LED flashes",
        "causes": [
          "Supply voltage below the permitted tolerance (24 VDC -15 %)"
        ],
        "confirm": [
          "Measure A1 to A2 under load: below 20.4 VDC confirms."
        ],
        "fix": [
          "Check the supply voltage and increase it if necessary."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_s3_Operat_Man_21395-EN-19.pdf (Error indicators p. 19; Technical details p. 21)"
      },
      {
        "title": "Plug terminator not connected",
        "symptom": "FAULT LED on (steady)",
        "causes": [
          "Plug terminator missing at the side of the unit (no PNOZsigma contact expansion module connected)"
        ],
        "confirm": [
          "Check the side of the unit for the plug terminator / expansion connector."
        ],
        "fix": [
          "Insert the plug terminator, switch the supply voltage off and then on again."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_s3_Operat_Man_21395-EN-19.pdf (Error indicators p. 19; Installation p. 11)"
      },
      {
        "title": "Internal error, unit defective",
        "symptom": "FAULT LED flashes",
        "causes": [
          "Internal error"
        ],
        "confirm": [
          "FAULT flashing with no other LED flashing."
        ],
        "fix": [
          "Switch the supply voltage off and then on again; change the unit if necessary."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_s3_Operat_Man_21395-EN-19.pdf (Error indicators p. 19)"
      },
      {
        "title": "Connection error / cross-short S12-S22",
        "symptom": "IN1 and IN2 flash alternately, FAULT on; unit will not switch on",
        "causes": [
          "Short detected between S12 and S22",
          "Cable resistance in the input circuit too high",
          "Wiring does not match the selected operating mode (with/without detection of shorts across contacts)"
        ],
        "confirm": [
          "Power off, disconnect the input terminals, measure S12 to S22: continuity confirms a cross-short.",
          "Measure each input loop (S11-S12, S21-S22) with the safeguard closed: more than 30 Ohm (dual-channel with detection / single-channel) or 60 Ohm (dual-channel without detection) is too high."
        ],
        "fix": [
          "Rectify the connection error or short across contacts, then switch the supply voltage off and then on again."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_s3_Operat_Man_21395-EN-19.pdf (Error indicators p. 19; Technical details p. 21 (Rlmax))"
      },
      {
        "title": "Simultaneity: power-up blocked after short interruption on one channel",
        "symptom": "IN1 (or IN2) flashes, FAULT on; outputs will not close after the safeguard is closed",
        "causes": [
          "Short-term interruption at S12 (IN1) or S22 (IN2) only - the input channels were not opened simultaneously (loose wire, bouncing or misaligned E-STOP / gate contact)"
        ],
        "confirm": [
          "Observe which IN LED flashes: IN1 = channel S11-S12, IN2 = channel S21-S22.",
          "Check that channel's contact and terminals; measure S12 (or S22) to A2 while operating the safeguard: the reading must drop together with the other channel."
        ],
        "fix": [
          "Open S11-S12 and S21-S22 simultaneously (operate the E-STOP / open the gate) and then close again.",
          "Repair the intermittent contact/wire on the indicated channel."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_s3_Operat_Man_21395-EN-19.pdf (Error indicators pp. 19-20)"
      },
      {
        "title": "Simultaneity: power-up blocked on both channels",
        "symptom": "IN1 and IN2 flash simultaneously, FAULT on",
        "causes": [
          "Short-term interruption at S12 and S22; channels in the input circuit not opened simultaneously"
        ],
        "confirm": [
          "IN1 and IN2 flashing together with FAULT on."
        ],
        "fix": [
          "Open S11-S12 and S21-S22 simultaneously and then close again."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_s3_Operat_Man_21395-EN-19.pdf (Error indicators p. 20)"
      },
      {
        "title": "Rotary switch position not permitted / changed in operation",
        "symptom": "START flashes, FAULT on; safety contacts open",
        "causes": [
          "Operating mode rotary switch not locked in a permitted position",
          "Rotary switch adjusted during operation"
        ],
        "confirm": [
          "Open the front cover and check the 'mode' switch clicks into a defined position."
        ],
        "fix": [
          "Switch the supply voltage off, set the mode switch to a locked position, then switch on again."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_s3_Operat_Man_21395-EN-19.pdf (Error indicators p. 20; Set operating modes p. 12)"
      },
      {
        "title": "Mode selector in start (vertical) position",
        "symptom": "POWER, IN1, IN2, OUT, START and FAULT all lit",
        "causes": [
          "Operating mode selector switch 'mode' left in its start (vertical) position - as delivered"
        ],
        "confirm": [
          "All six LEDs lit; open the cover and check the mode switch."
        ],
        "fix": [
          "Switch off the supply voltage and set the required operating mode on the 'mode' selector switch."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_s3_Operat_Man_21395-EN-19.pdf (Error indicators p. 20; Set operating modes p. 12)"
      },
      {
        "title": "Will not switch on: start circuit / feedback loop open",
        "symptom": "POWER, IN1, IN2 lit but OUT stays off; START LED does not light when reset is pressed (manual / monitored start)",
        "causes": [
          "Reset button S3 or its wiring S12-S34 open",
          "Feedback loop open: N/C contacts of external contactors K5/K6 (in series in S12-S34) not closed - contactor stuck in or welded",
          "Automatic start selected without the S12-S34 link / feedback loop",
          "Monitored start: start button held too short (falling edge min. 100 ms, rising edge min. 30 ms) or pressed within the waiting period (rising edge 120 ms, falling edge 250 ms)"
        ],
        "confirm": [
          "Press reset and measure S34 to A2: about 24 VDC and START LED on means the start circuit closes; 0 V means S3 or the K5/K6 feedback contacts are open.",
          "Power off and check continuity of each K5/K6 N/C feedback contact: open with the contactor de-energized means it is stuck/welded."
        ],
        "fix": [
          "Repair the reset button / start-circuit wiring.",
          "Replace the welded or stuck external contactor in the feedback loop.",
          "Monitored start: release the reset button so the falling edge is seen, or close it after the waiting period."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_s3_Operat_Man_21395-EN-19.pdf (Connection: start circuit/feedback loop p. 14; Function description pp. 9-10; Status indicators p. 18; Technical details p. 23 (times))"
      },
      {
        "title": "Safety contacts welded",
        "symptom": "Unit cannot be reactivated after the input circuit has opened",
        "causes": [
          "Welded safety contact (no or oversized contact fuse, overload, inductive load without suppression)"
        ],
        "confirm": [
          "Power off, measure 13-14 and 23-24: continuity with the unit de-energized confirms a welded contact."
        ],
        "fix": [
          "Replace the unit. Fit the specified contact fuse ahead of the safety contacts (10 A quick, 6 A slow, 10 A gG or 6 A B/C breaker) and spark suppression on inductive loads."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_s3_Operat_Man_21395-EN-19.pdf (Faults - malfunctions p. 20; Wiring p. 11; Technical details p. 23)"
      },
      {
        "title": "Unexpected automatic restart",
        "symptom": "Outputs close as soon as the E-STOP is released / gate closed, without pressing reset",
        "causes": [
          "Automatic start selected",
          "Manual start with bridged (shorted) start contact - the device does not detect shorts in the start/feedback loop"
        ],
        "confirm": [
          "Check the mode switch setting.",
          "Power off, measure S12 to S34 with the reset button released: continuity means the start contact is bridged."
        ],
        "fix": [
          "Correct the start-circuit wiring / mode; use external circuit measures to prevent an unexpected restart."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_s3_Operat_Man_21395-EN-19.pdf (Connection p. 14 (NOTICE); Function description p. 10 (NOTICE))"
      }
    ],
    "sources": [
      "https://www.pilz.com/download/open/PNOZ_s3_Operat_Man_21395-EN-19.pdf (Operating Manual PNOZ s3, 21395-EN-19)"
    ]
  },
  {
    "id": "pilz-pnoz-x2-8p",
    "title": "Pilz PNOZ X2.8P safety relay, 3 N/O + 1 N/C",
    "match": {
      "categories": [
        "safetyRelay"
      ],
      "manufacturer": "Pilz",
      "family": "PNOZ X2\\.8P"
    },
    "normal": [
      {
        "terminals": "A1 to A2",
        "state": "powered, 24 V types (777301, 787301)",
        "meter": "VDC",
        "pins": [
          [
            "A1",
            "A2"
          ]
        ],
        "expected": "24 VAC/DC, tolerance -15 %/+10 % (20.4-26.4 V); AC 50-60 Hz",
        "note": "Measure VAC on AC supply. 24 V types need SELV/PELV supply. Technical details pp. 17/22."
      },
      {
        "terminals": "A1 to A2",
        "state": "powered, 24-240 V types (777302, 787302)",
        "meter": "VDC",
        "pins": [
          [
            "A1",
            "A2"
          ]
        ],
        "expected": "24-240 VAC/DC, tolerance -15 %/+10 % (20.4-264 V); AC 50-60 Hz",
        "note": "Measure VAC on AC supply. On these types S21 is connected to protective earth (Preparing for operation p. 13)."
      },
      {
        "terminals": "S12 to S34",
        "state": "unit ready / start: automatic start link or reset button S3 pressed",
        "meter": "continuity",
        "pins": [
          [
            "S12",
            "S34"
          ]
        ],
        "expected": "closed (power off when measuring ohms)",
        "note": "'The unit is ready for operation when the start circuit S12-S34 is closed' (p. 10). Feedback N/C contacts K5/K6 are in series here when used."
      },
      {
        "terminals": "13-14, 23-24, 33-34",
        "state": "input circuit closed, unit active (CH.1, CH.2 lit)",
        "meter": "continuity",
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
        ],
        "expected": "closed"
      },
      {
        "terminals": "41-42",
        "state": "input circuit closed, unit active (CH.1, CH.2 lit)",
        "meter": "continuity",
        "pins": [
          [
            "41",
            "42"
          ]
        ],
        "expected": "open"
      },
      {
        "terminals": "13-14, 23-24, 33-34",
        "state": "input circuit opened (E-STOP operated)",
        "meter": "continuity",
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
        ],
        "expected": "open (opened redundantly)"
      },
      {
        "terminals": "41-42",
        "state": "input circuit opened (E-STOP operated)",
        "meter": "continuity",
        "pins": [
          [
            "41",
            "42"
          ]
        ],
        "expected": "closed"
      },
      {
        "terminals": "input circuit loop (S11-S12 / S21-S22 with E-STOP released)",
        "state": "power off, wiring disconnected from the unit",
        "meter": "ohms",
        "pins": [
          [
            "S11",
            "S12"
          ],
          [
            "S21",
            "S22"
          ]
        ],
        "expected": "total cable resistance <= Rlmax: 15 Ohm dual-channel with detection of shorts across contacts; dual-channel without detection 50 Ohm DC / 100 Ohm AC (24 V types), 80 Ohm (24-240 V types); single-channel 30 Ohm DC / 100 Ohm AC (24 V types), 45 Ohm (24-240 V types)",
        "note": "Technical details pp. 17/22. Input circuit 24 VDC; 30 mA (24 V types) / 25 mA (24-240 V types). Without detection of shorts, dual-channel is wired S11-S12 and S11-S52 with S21-S22 linked (Preparing for operation p. 13)."
      }
    ],
    "pairs": [
      {
        "a": "13",
        "b": "14",
        "when": "safety OK",
        "note": "Input circuit closed, unit active (p. 10)."
      },
      {
        "a": "23",
        "b": "24",
        "when": "safety OK",
        "note": "Input circuit closed, unit active (p. 10)."
      },
      {
        "a": "33",
        "b": "34",
        "when": "safety OK",
        "note": "Input circuit closed, unit active (p. 10)."
      },
      {
        "a": "41",
        "b": "42",
        "when": "safety not OK",
        "note": "Auxiliary N/C closes when the input circuit is opened (p. 10); not for safety circuits (p. 12)."
      }
    ],
    "indicators": [
      {
        "name": "POWER",
        "state": "on",
        "meaning": "Supply voltage is present"
      },
      {
        "name": "CH.1",
        "state": "on",
        "meaning": "Safety contacts of channel 1 are closed"
      },
      {
        "name": "CH.2",
        "state": "on",
        "meaning": "Safety contacts of channel 2 are closed"
      },
      {
        "name": "CH.1, CH.2",
        "state": "off",
        "meaning": "Input circuit opened (e.g. E-STOP operated): safety contacts open, 41-42 closed"
      },
      {
        "name": "POWER",
        "state": "off",
        "meaning": "Short circuit or no supply voltage"
      }
    ],
    "faults": [
      {
        "title": "POWER LED does not light",
        "symptom": "POWER off, all contacts open",
        "causes": [
          "No supply voltage at A1/A2",
          "Short circuit (unit's internal fuse triggered)"
        ],
        "confirm": [
          "Measure A1 to A2: 20.4-26.4 V on 24 V types, 20.4-264 V on 24-240 V types. 0 V means the supply side is open.",
          "Voltage present but POWER off: a short circuit / earth fault has triggered the unit's fuse (see earth-fault entry)."
        ],
        "fix": [
          "Restore the supply; if a short caused it, remove the short and switch the supply off for approx. 1 minute."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_X2_8P_Operat_Manual_1004082-EN-24.pdf (Faults - Interference p. 16; Technical details pp. 17/22)"
      },
      {
        "title": "Earth fault",
        "symptom": "Supply voltage fails and safety contacts open; POWER LED off",
        "causes": [
          "Earth fault in the start or input circuit"
        ],
        "confirm": [
          "Power off, unplug the input/start terminals and measure each S-terminal wire to earth: low resistance confirms."
        ],
        "fix": [
          "Rectify the earth fault, then switch the supply voltage off for approx. 1 minute; the unit is ready for operation again."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_X2_8P_Operat_Manual_1004082-EN-24.pdf (Faults - Interference p. 16; Operating modes p. 10)"
      },
      {
        "title": "Short across contacts S12-S22 (detection mode)",
        "symptom": "Outputs open and unit drops out (may take up to 2 minutes with long cables)",
        "causes": [
          "Cross-short between the two input channels (S12 and S22) with dual-channel wiring with detection of shorts across contacts"
        ],
        "confirm": [
          "Power off, disconnect the input terminals and measure S12 to S22: continuity confirms a cross-short."
        ],
        "fix": [
          "Remove the short circuit and switch off the supply voltage for approx. 1 minute to reset the unit's fuse."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_X2_8P_Operat_Manual_1004082-EN-24.pdf (Wiring p. 12 (Important for detection of shorts across contacts))"
      },
      {
        "title": "Will not switch on: start circuit open",
        "symptom": "POWER lit, input circuit closed, CH.1/CH.2 stay off",
        "causes": [
          "Automatic start: S12-S34 link missing",
          "Manual start: reset button S3 or its wiring open"
        ],
        "confirm": [
          "Power off; measure S12 to S34 with the reset button pressed (or the auto-start link fitted): must be continuity."
        ],
        "fix": [
          "Repair the start circuit wiring / reset button so S12-S34 closes."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_X2_8P_Operat_Manual_1004082-EN-24.pdf (Function Description p. 10; Start circuit p. 14)"
      },
      {
        "title": "Will not switch on: feedback loop open",
        "symptom": "POWER lit, input circuit closed, CH.1/CH.2 stay off when reset is pressed",
        "causes": [
          "N/C contact of external contactor K5 or K6 (in series in S12-S34) open - contactor stuck in or welded, or feedback wiring open"
        ],
        "confirm": [
          "Power off, de-energize K5/K6 and measure across each feedback N/C contact: open confirms."
        ],
        "fix": [
          "Replace the stuck/welded contactor or repair the feedback wiring."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_X2_8P_Operat_Manual_1004082-EN-24.pdf (Feedback loop p. 15)"
      },
      {
        "title": "Will not switch on: input circuit open or cable too long",
        "symptom": "POWER lit, CH.1/CH.2 off with the E-STOP released / gate closed",
        "causes": [
          "E-STOP / gate contact or wiring open on S11-S12 or S21-S22 (or S52 link missing for the selected wiring)",
          "Input cable resistance above Rlmax"
        ],
        "confirm": [
          "Power off, unplug the input terminals and measure each loop: open, or above Rlmax (15 Ohm dual-channel with detection), confirms."
        ],
        "fix": [
          "Repair the safeguard contact / wiring; wire per the input-circuit diagram for the chosen mode; shorten or upsize cables to stay within Rlmax."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_X2_8P_Operat_Manual_1004082-EN-24.pdf (Preparing for operation p. 13; Wiring p. 12; Technical details pp. 17/22)"
      },
      {
        "title": "Safety contacts welded",
        "symptom": "Unit cannot be reactivated after the input circuit has opened",
        "causes": [
          "Welded safety contact (overcurrent, missing contact fuse, unsuppressed inductive load)"
        ],
        "confirm": [
          "Power off and measure 13-14, 23-24, 33-34: any continuity with the unit de-energized confirms."
        ],
        "fix": [
          "Replace the unit. Fit the contact fuse from the technical details ahead of the contacts (24 V types: 10 A quick / 6 A slow / 6 A gG / 6 A B/C; 24-240 V types: 6 A quick / 4 A slow / 6 A gG / 4 A B/C) and spark suppression."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_X2_8P_Operat_Manual_1004082-EN-24.pdf (Faults - Interference p. 16; Wiring p. 12; Technical details pp. 19/24)"
      },
      {
        "title": "Unexpected automatic restart",
        "symptom": "Outputs close as soon as the E-STOP is released, without pressing reset",
        "causes": [
          "Automatic start wiring (S12-S34 linked)",
          "Manual start with bridged start contact - shorts in the start/feedback loop are not detected"
        ],
        "confirm": [
          "Power off, measure S12 to S34 with the reset button released: continuity means the start contact is bridged or auto-start is wired."
        ],
        "fix": [
          "Correct the start-circuit wiring; use external circuit measures to prevent an unexpected restart."
        ],
        "source": "https://www.pilz.com/download/open/PNOZ_X2_8P_Operat_Manual_1004082-EN-24.pdf (Start circuit p. 14 (NOTICE); Operating modes p. 10 (NOTICE))"
      }
    ],
    "sources": [
      "https://www.pilz.com/download/open/PNOZ_X2_8P_Operat_Manual_1004082-EN-24.pdf (Operating Manual PNOZ X2.8P, 1004082-EN-24)"
    ]
  }
];
