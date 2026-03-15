# ============================================================

# FILE: src/etl_core/decorators/**init**.py

# ============================================================

# ============================================================

# FILE: src/etl_core/decorators/error_handler.py

# ============================================================

from **future** import annotations

import functools
from typing import Any, Callable

from etl_core.exceptions.base_exception import ETLException
from etl_core.exceptions.error_codes import ErrorCode
from etl_core.logging.logger import get_logger

logger = get_logger(**name**)

def etl_exception_handler(
error_code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
message: str = “Service operation failed”,
) -> Callable:
“””
Decorator that wraps any service method with standardised error handling.

```
- If the function raises an ETLException  → re-raised as-is.
- If the function raises any other Exception → wrapped in an ETLException
  with the given error_code and message, plus details from the original error.

Usage:
    @etl_exception_handler(
        error_code=ErrorCode.FILE_READ_ERROR,
        message="Failed to read file",
    )
    def read_files(self, files): ...
"""

def decorator(fn: Callable) -> Callable:
    @functools.wraps(fn)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        try:
            return fn(*args, **kwargs)
        except ETLException:
            raise
        except Exception as exc:
            logger.exception(
                "%s failed in %s.%s",
                message,
                fn.__module__,
                fn.__qualname__,
            )
            raise ETLException(
                message=f"{message}: {exc}",
                error_code=error_code,
                details={
                    "function": fn.__qualname__,
                    "error": str(exc),
                },
            ) from exc

    return wrapper

return decorator
```

# ============================================================

# FILE: src/etl_core/services/file_service.py  (updated)

# ============================================================

from **future** import annotations

from pathlib import Path

from etl_core.decorators.error_handler import etl_exception_handler
from etl_core.exceptions.base_exception import ETLException
from etl_core.exceptions.error_codes import ErrorCode
from etl_core.logging.logger import get_logger

logger = get_logger(**name**)

class FileService:

```
@etl_exception_handler(
    error_code=ErrorCode.FILE_READ_ERROR,
    message="Failed to read files",
)
def read_files(self, files: list[Path]) -> list[str]:
    if not files:
        raise ETLException(
            message="No input files found",
            error_code=ErrorCode.FILE_NOT_FOUND,
            details={"file_count": 0},
        )

    data: list[str] = []
    for f in files:
        logger.info("Reading file %s", f)
        data.append(f.read_text(encoding="utf-8"))

    return data
```
