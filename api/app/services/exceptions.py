from __future__ import annotations


class ConnectionNotFoundError(RuntimeError):
    def __init__(self, connection_id: str) -> None:
        super().__init__(f"Discord connection {connection_id} does not exist.")
