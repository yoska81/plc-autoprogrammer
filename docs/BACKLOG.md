# Decisions and backlog (from the user)

Decisions (2026-10-16):
- **Label printers:** a selectable printer list with real label/tape sizes; start with **Brady**, other brands later. (Dev 1)
- **Company:** "ISA" for now on title blocks and document covers. (done)
- **Machining DXF:** default **inches**, with **dual dimensions** (inch [mm]) in DXF text, hole tables and the drilling/door sheets. (Debug 2)
- **3D:** the cabinet STEP is loaded into **SolidWorks** — must import as an assembly with named parts, colours and correct units. (coordinator + Debug 2 check)
- **Delivery:** a **Windows program installed on the PC** (installer). (Debug 1)

Future (design now, build later):
- More vendors: **Siemens, Yaskawa, ifm, Allen-Bradley, Schneider** (PLCs, drives, sensors, HMI), alongside AutomationDirect / CLICK. Needs vendor-neutral catalogs and PLC profiles plus vendor export formats (TIA Portal, Studio 5000 L5X, PLCopen XML…). Design doc first. (Dev 2)
