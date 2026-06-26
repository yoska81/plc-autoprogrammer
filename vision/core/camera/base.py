from abc import ABC, abstractmethod

import numpy as np


class CameraSource(ABC):
    """Common interface shared by the real USB camera and the test-image feed."""

    @abstractmethod
    def open(self) -> None: ...

    @abstractmethod
    def read_frame(self) -> np.ndarray: ...

    @abstractmethod
    def close(self) -> None: ...

    def __enter__(self) -> "CameraSource":
        self.open()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()
