from .base import MachineSignalInterface


class SimulatedMachineInterface(MachineSignalInterface):
    """The only Machine Signal Interface backend in V1.

    `read_trigger()` is edge-triggered, mimicking a momentary PLC pulse:
    a UI button (or a future real input) calls `fire_trigger()` to arm
    it, and the next `read_trigger()` call consumes the arm and returns
    to OFF. Status is always "Simulation" once connected.
    """

    def __init__(self):
        self._connected = False
        self._trigger_armed = False
        self._last_result: str | None = None  # "GOOD" | "BAD" | None

    def connect(self) -> None:
        self._connected = True

    def disconnect(self) -> None:
        self._connected = False
        self._trigger_armed = False

    def fire_trigger(self) -> None:
        """Arms the trigger. Called by the UI's trigger button in V1."""
        if self._connected:
            self._trigger_armed = True

    def read_trigger(self) -> bool:
        if not self._connected or not self._trigger_armed:
            return False
        self._trigger_armed = False
        return True

    def send_good(self) -> None:
        self._last_result = "GOOD"

    def send_bad(self) -> None:
        self._last_result = "BAD"

    def send_no_product(self) -> None:
        self._last_result = "NO_PRODUCT"

    def reset_outputs(self) -> None:
        self._last_result = None

    def get_status(self) -> str:
        return "Simulation" if self._connected else "Disconnected"

    @property
    def last_result(self) -> str | None:
        return self._last_result
