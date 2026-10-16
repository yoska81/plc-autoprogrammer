(* Test cell — Micro850 2080-L50E-24QBB *)
(* Micro800 Structured Text for one CCW program; declare the variables listed in the variable file. *)

(* ===== Inputs ===== *)
Start_PB := _IO_EM_DI_00;
Stop_PB := _IO_EM_DI_01;
Part_sensor := _IO_EM_DI_02;

(* 1-second clock: ON 0.5 s, OFF 0.5 s *)
CLOCK_TMR(IN := NOT CLOCK_TMR.Q, PT := T#1s);
Clock_1s := ANY_TO_DINT(CLOCK_TMR.ET) < 500;

(* ===== Conveyor ===== *)
(* Seal-in *)
Run_Latch := (Start_PB AND NOT Stop_PB) OR (Run_Latch AND NOT Stop_PB);
Conveyor_run := Run_Latch AND NOT Jam_Timer.Q;
(* Jam timer *)
Jam_Timer(IN := Run_Latch AND Part_sensor, PT := ANY_TO_TIME(Jam_Time_SP * 1000));
Run_Hours(IN := Conveyor_run, RST := Stop_PB, PT := ANY_TO_TIME(3600000));
(* Count parts *)
RT_1(CLK := Part_sensor);
Part_Count(CU := RT_1.Q, RESET := _SYSVA_FIRST_SCAN OR CT1_RST, PV := 100);
CT1_RST := FALSE;

(* ===== General ===== *)
IF _SYSVA_FIRST_SCAN THEN Jam_Time_SP := 10; END_IF;
Alarm_light := Clock_1s AND (Part_Count.CV >= 90);
FT_2(CLK := Run_Latch);
IF FT_2.Q THEN CT1_RST := TRUE; END_IF;
IF FT_2.Q THEN DS2 := (ANY_TO_DINT(Jam_Timer.ET) / 1000) + 1; END_IF;

(* ===== Outputs ===== *)
_IO_EM_DO_00 := Conveyor_run;
_IO_EM_DO_01 := Alarm_light;
