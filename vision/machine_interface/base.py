"""Abstract Machine Signal Interface.

Models a future, deliberately transport-agnostic PC<->PLC link: a
momentary trigger pulse in ("take picture now") and a GOOD/BAD result
out. Not PLC logic, not ladder logic - the PC remains the brain and
makes every inspection decision; this interface only carries two simple
signals between the PC and whatever machine controller is on the other
end of the cable.

V1 ships only `simulator.py`. Future backends (Modbus TCP, Modbus RTU,
serial, USB relay, Ethernet I/O, ...) implement this same interface and
slot into core/app.py without changing the engine.
"""
from abc import ABC, abstractmethod


class MachineSignalInterface(ABC):
    """Common interface shared by every Machine Signal Interface backend."""

    @abstractmethod
    def connect(self) -> None: ...

    @abstractmethod
    def disconnect(self) -> None: ...

    @abstractmethod
    def read_trigger(self) -> bool:
        """Edge-triggered read: True once per incoming pulse, then OFF again."""

    @abstractmethod
    def send_good(self) -> None: ...

    @abstractmethod
    def send_bad(self) -> None: ...

    @abstractmethod
    def reset_outputs(self) -> None: ...

    @abstractmethod
    def get_status(self) -> str: ...
