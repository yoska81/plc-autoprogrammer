# Decisions and backlog (from the user)

Decisions (2026-10-16):
- **Label printers:** a selectable printer list with real label/tape sizes; start with **Brady**, other brands later. (Dev 1)
- **Company:** "ISA" for now on title blocks and document covers. (done)
- **Machining DXF:** default **inches**, with **dual dimensions** (inch [mm]) in DXF text, hole tables and the drilling/door sheets. (Debug 2)
- **3D:** the cabinet STEP is loaded into **SolidWorks** — must import as an assembly with named parts, colours and correct units. (coordinator + Debug 2 check)
- **Delivery:** a **Windows program installed on the PC** (installer). (Debug 1)

Future (design now, build later):
- More vendors: **Siemens, Yaskawa, ifm, Allen-Bradley, Schneider** (PLCs, drives, sensors, HMI), alongside AutomationDirect / CLICK. Needs vendor-neutral catalogs and PLC profiles plus vendor export formats (TIA Portal, Studio 5000 L5X, PLCopen XML…). Design doc first. (Dev 2)

## Started 2026-10-16 (user: "start to work on more standards and equipment")
- **Equipment, multi-vendor catalogs + chooser (Dev 1):** Allen-Bradley, Siemens, Schneider, Yaskawa, ifm, Hoffman/Rittal alongside AutomationDirect; verified part numbers with sources only; brand preference per project, mixed brands allowed.
- **PLC profiles + exporters (Dev 2, after VFDs):** Allen-Bradley CompactLogix/Micro800 (L5X) first, then Siemens S7-1200/1500 (TIA: SCL + tag table), then Schneider M221/M241 (PLCopen XML).
- **Regions & standards (Debug 1, after the HMI picture fix):** Europe/IEC and Israel (IEC 60204-1, 400/230 V 50 Hz, mm² sizing, IEC colours, IEC 60617 symbols option, IEC 81346 designations, ISO 13849-1 / IEC 62061, IEC 61439, CE notes, A3 drawings).
- **IEC code rules + vendor-catalog cross-check (Debug 2, after the machine layout).**
- Label printer brands beyond Brady: parked (lower priority).
