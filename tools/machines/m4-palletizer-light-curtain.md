# Palletizer cell

Cases come down a conveyor into a cell. A robot (it has its own controller, we just need to talk to it with a few signals: robot ready, start pick, pick done, robot fault, pallet full) stacks them on a pallet. There are two pallet positions so the operator can take a full pallet away with a forklift while the robot stacks on the other one.

Each pallet position has a light curtain at the opening. When the operator goes into position 1 the robot must only work on position 2 and vice versa — and if somebody goes in where the robot is working, the robot has to stop safely. There are pallet present sensors on each position and a button "pallet removed / new pallet ready" for each side with a light. The infeed conveyor is 1 HP 480 V and has a case-at-end sensor and a jam sensor. Stack light on top (green running, amber needs attention, red fault). E-stops on the panel and one at each pallet opening. We'd like a screen showing which side is full and the counts.
