# ============================================================

# FILE: pyproject.toml

# ============================================================

[project]
name = “etl-core”
version = “0.1.0”
description = “Reusable ETL framework”
requires-python = “>=3.10”
dependencies = [
“pydantic>=2.0”,
]

[project.optional-dependencies]
dev = [
“pytest>=7.0”,
“pytest-cov”,
“mypy”,
“ruff”,
]

[build-system]
requires = [“setuptools>=68.0”, “wheel”]
build-backend = “setuptools.build_meta”

[tool.setuptools.packages.find]
where = [“src”]

[tool.setuptools.package-data]
etl_core = [“py.typed”]

[tool.mypy]
strict = true

[tool.ruff]
line-length = 100

[tool.pytest.ini_options]
testpaths = [“tests”]

# ============================================================

# FILE: src/etl_core/**init**.py

# ============================================================

“”“ETL Core framework — reusable pipeline building blocks.”””

# ============================================================

# FILE: src/etl_core/py.typed

# ============================================================

# (empty marker file — enables PEP 561 typed-package support)

# ============================================================

# FILE: src/etl_core/logging/**init**.py

# ============================================================

# ============================================================

# FILE: src/etl_core/logging/logger.py

# ============================================================

from **future** import annotations

import logging
import sys

def setup_logging(level: str = “INFO”) -> None:
“”“Configure root logging. Call once at application entry point.”””
logging.basicConfig(
level=level,
format=”%(asctime)s | %(levelname)s | %(name)s | %(message)s”,
handlers=[logging.StreamHandler(sys.stdout)],
force=True,
)

def get_logger(name: str) -> logging.Logger:
return logging.getLogger(name)

# ============================================================

# FILE: src/etl_core/exceptions/**init**.py

# ============================================================

# ============================================================

# FILE: src/etl_core/exceptions/error_codes.py

# ============================================================

from enum import Enum

class ErrorCode(str, Enum):
FILE_NOT_FOUND = “FILE_NOT_FOUND”
FILE_READ_ERROR = “FILE_READ_ERROR”
INVALID_DATA = “INVALID_DATA”
INVALID_PATH = “INVALID_PATH”
INVALID_DATE = “INVALID_DATE”
PIPELINE_FAILED = “PIPELINE_FAILED”
UNKNOWN_ERROR = “UNKNOWN_ERROR”

# ============================================================

# FILE: src/etl_core/exceptions/base_exception.py

# ============================================================

from **future** import annotations

from etl_core.exceptions.error_codes import ErrorCode

class ETLException(Exception):
“”“Base exception for all ETL business errors.”””

```
def __init__(
    self,
    message: str,
    error_code: ErrorCode,
    details: dict | None = None,
) -> None:
    self.message = message
    self.error_code = error_code
    self.details = details or {}
    super().__init__(message)
```

# ============================================================

# FILE: src/etl_core/utils/**init**.py

# ============================================================

# ============================================================

# FILE: src/etl_core/utils/constants.py

# ============================================================

from **future** import annotations

# Base system path — override via env variable or config in production

SYSTEM_PATH: str = “/data/system”

# ============================================================

# FILE: src/etl_core/schemas/**init**.py

# ============================================================

# ============================================================

# FILE: src/etl_core/schemas/run_parameters.py

# ============================================================

from **future** import annotations

import datetime

from pydantic import BaseModel, computed_field, field_validator

from etl_core.utils.constants import SYSTEM_PATH

class RunParameters(BaseModel):
“””
Core run parameters passed into every pipeline.

```
Matches the production pattern:
  - config_path / config_pattern  → locate input files
  - run_env                       → environment tag (dev / uat / prod)
  - directory                     → logical grouping name
  - root                          → sub-folder under SYSTEM_PATH
  - expected_run_date             → date string (YYYY-MM-DD or YYYYMMDD)
  - test_run                      → flag to enable dry-run / test mode
  - temp_file_path                → scratch area for intermediate files
"""

config_path: str
config_pattern: str
run_env: str
directory: str = "TTRControls"
root: str
expected_run_date: str
test_run: bool = False
temp_file_path: str

# ── validators ───────────────────────────────────────────

@field_validator("config_path")
@classmethod
def config_path_not_empty(cls, v: str) -> str:
    if not v.strip():
        raise ValueError("config_path must not be empty")
    return v

@field_validator("config_pattern")
@classmethod
def config_pattern_not_empty(cls, v: str) -> str:
    if not v.strip():
        raise ValueError("config_pattern must not be empty")
    return v

@field_validator("expected_run_date")
@classmethod
def validate_date_format(cls, v: str) -> str:
    """Accept YYYY-MM-DD (len 10) or YYYYMMDD (len 8)."""
    if len(v) == 10:
        datetime.datetime.strptime(v, "%Y-%m-%d")
    elif len(v) == 8:
        datetime.datetime.strptime(v, "%Y%m%d")
    else:
        raise ValueError(
            f"expected_run_date must be YYYY-MM-DD or YYYYMMDD, got: {v}"
        )
    return v

# ── computed fields ──────────────────────────────────────

@computed_field
@property
def root_directory(self) -> str:
    """Full path: SYSTEM_PATH / root."""
    return SYSTEM_PATH + "/" + self.root

@computed_field
@property
def run_date(self) -> str:
    """Normalised run date → always YYYY-MM-DD."""
    if len(self.expected_run_date) == 10:
        dt = datetime.datetime.strptime(self.expected_run_date, "%Y-%m-%d")
    else:
        dt = datetime.datetime.strptime(self.expected_run_date, "%Y%m%d")
    return dt.strftime("%Y-%m-%d")
```

# ============================================================

# FILE: src/etl_core/schemas/pipeline_result.py

# ============================================================

from **future** import annotations

from typing import Any

from pydantic import BaseModel

class PipelineResult(BaseModel):
“”“Uniform envelope returned by every pipeline execution.”””

```
success: bool
data: Any = None
error_code: str | None = None
message: str | None = None
details: dict | None = None

@classmethod
def ok(cls, data: Any) -> PipelineResult:
    return cls(success=True, data=data)

@classmethod
def fail(
    cls,
    error_code: str,
    message: str,
    details: dict | None = None,
) -> PipelineResult:
    return cls(
        success=False,
        error_code=error_code,
        message=message,
        details=details,
    )
```

# ============================================================

# FILE: src/etl_core/context/**init**.py

# ============================================================

# ============================================================

# FILE: src/etl_core/context/run_context.py

# ============================================================

from **future** import annotations

from etl_core.schemas.run_parameters import RunParameters

class RunContext:
“”“Immutable runtime context threaded through every node.”””

```
__slots__ = ("_params",)

def __init__(self, params: RunParameters) -> None:
    self._params = params

# ── direct accessors ─────────────────────────────────────

@property
def config_path(self) -> str:
    return self._params.config_path

@property
def config_pattern(self) -> str:
    return self._params.config_pattern

@property
def run_env(self) -> str:
    return self._params.run_env

@property
def directory(self) -> str:
    return self._params.directory

@property
def root(self) -> str:
    return self._params.root

@property
def expected_run_date(self) -> str:
    return self._params.expected_run_date

@property
def test_run(self) -> bool:
    return self._params.test_run

@property
def temp_file_path(self) -> str:
    return self._params.temp_file_path

# ── computed accessors ───────────────────────────────────

@property
def root_directory(self) -> str:
    return self._params.root_directory

@property
def run_date(self) -> str:
    return self._params.run_date
```

# ============================================================

# FILE: src/etl_core/utils/path_utils.py

# ============================================================

from **future** import annotations

from pathlib import Path

from etl_core.exceptions.base_exception import ETLException
from etl_core.exceptions.error_codes import ErrorCode
from etl_core.logging.logger import get_logger

logger = get_logger(**name**)

def get_files(path: str | Path, pattern: str) -> list[Path]:
“”“Glob for files, failing fast if the directory is invalid.”””
p = Path(path)
if not p.is_dir():
raise ETLException(
message=f”Path is not a valid directory: {p}”,
error_code=ErrorCode.INVALID_PATH,
details={“path”: str(p)},
)

```
logger.info("Searching files in %s with pattern %s", p, pattern)
files = sorted(p.glob(pattern))
logger.info("Found %d file(s)", len(files))
return files
```

# ============================================================

# FILE: src/etl_core/services/**init**.py

# ============================================================

# ============================================================

# FILE: src/etl_core/services/file_service.py

# ============================================================

from **future** import annotations

from pathlib import Path

from etl_core.exceptions.base_exception import ETLException
from etl_core.exceptions.error_codes import ErrorCode
from etl_core.logging.logger import get_logger

logger = get_logger(**name**)

class FileService:

```
def read_files(self, files: list[Path]) -> list[str]:
    if not files:
        raise ETLException(
            message="No input files found",
            error_code=ErrorCode.FILE_NOT_FOUND,
            details={"file_count": 0},
        )

    data: list[str] = []
    for f in files:
        try:
            logger.info("Reading file %s", f)
            data.append(f.read_text(encoding="utf-8"))
        except ETLException:
            raise
        except Exception as exc:
            raise ETLException(
                message=f"Failed to read file: {f}",
                error_code=ErrorCode.FILE_READ_ERROR,
                details={"file": str(f), "error": str(exc)},
            ) from exc

    return data
```

# ============================================================

# FILE: src/etl_core/nodes/**init**.py

# ============================================================

# ============================================================

# FILE: src/etl_core/nodes/base.py

# ============================================================

from **future** import annotations

from abc import ABC, abstractmethod
from typing import Any

class BaseNode(ABC):

```
@abstractmethod
def run(self, data: Any = None) -> Any:
    """Execute the node. `data` is None for entry nodes (e.g. readers)."""
```

# ============================================================

# FILE: src/etl_core/nodes/reading.py

# ============================================================

from **future** import annotations

from typing import Any

from etl_core.context.run_context import RunContext
from etl_core.exceptions.base_exception import ETLException
from etl_core.exceptions.error_codes import ErrorCode
from etl_core.logging.logger import get_logger
from etl_core.nodes.base import BaseNode
from etl_core.strategies.reading.base import BaseReadingStrategy

logger = get_logger(**name**)

class ReadingNode(BaseNode):

```
def __init__(self, context: RunContext, strategy: BaseReadingStrategy) -> None:
    self.context = context
    self.strategy = strategy

def run(self, data: Any = None) -> list[str]:
    logger.info("Running ReadingNode")
    try:
        result = self.strategy.read(self.context)
        logger.info("ReadingNode completed")
        return result
    except ETLException:
        logger.exception("ReadingNode business error")
        raise
    except Exception as exc:
        logger.exception("Unexpected error in ReadingNode")
        raise ETLException(
            message="ReadingNode failed unexpectedly",
            error_code=ErrorCode.UNKNOWN_ERROR,
            details={"error": str(exc)},
        ) from exc
```

# ============================================================

# FILE: src/etl_core/nodes/filter.py

# ============================================================

from **future** import annotations

from typing import Any

from etl_core.logging.logger import get_logger
from etl_core.nodes.base import BaseNode

logger = get_logger(**name**)

class FilterNode(BaseNode):

```
def run(self, data: Any = None) -> list[str]:
    logger.info("Running FilterNode")
    filtered = [d for d in (data or []) if d.strip()]
    logger.info("Filtered records: %d → %d", len(data or []), len(filtered))
    return filtered
```

# ============================================================

# FILE: src/etl_core/nodes/transform.py

# ============================================================

from **future** import annotations

from typing import Any

from etl_core.logging.logger import get_logger
from etl_core.nodes.base import BaseNode

logger = get_logger(**name**)

class TransformNode(BaseNode):

```
def run(self, data: Any = None) -> list[str]:
    logger.info("Running TransformNode")
    return [d.upper() for d in (data or [])]
```

# ============================================================

# FILE: src/etl_core/nodes/harmonise.py

# ============================================================

from **future** import annotations

from typing import Any

from etl_core.logging.logger import get_logger
from etl_core.nodes.base import BaseNode

logger = get_logger(**name**)

class HarmoniseNode(BaseNode):

```
def run(self, data: Any = None) -> list[str]:
    logger.info("Running HarmoniseNode")
    return [f"HARMONISED::{d}" for d in (data or [])]
```

# ============================================================

# FILE: src/etl_core/strategies/**init**.py

# ============================================================

# ============================================================

# FILE: src/etl_core/strategies/reading/**init**.py

# ============================================================

# ============================================================

# FILE: src/etl_core/strategies/reading/base.py

# ============================================================

from **future** import annotations

from abc import ABC, abstractmethod

from etl_core.context.run_context import RunContext

class BaseReadingStrategy(ABC):

```
@abstractmethod
def read(self, context: RunContext) -> list[str]:
    pass
```

# ============================================================

# FILE: src/etl_core/strategies/reading/qa_reading.py

# ============================================================

from **future** import annotations

from etl_core.context.run_context import RunContext
from etl_core.services.file_service import FileService
from etl_core.strategies.reading.base import BaseReadingStrategy
from etl_core.utils.path_utils import get_files

class QAReadingStrategy(BaseReadingStrategy):

```
def __init__(self, file_service: FileService | None = None) -> None:
    self._file_service = file_service or FileService()

def read(self, context: RunContext) -> list[str]:
    files = get_files(context.config_path, context.config_pattern)
    return self._file_service.read_files(files)
```

# ============================================================

# FILE: src/etl_core/strategies/reading/com_reading.py

# ============================================================

from **future** import annotations

from etl_core.context.run_context import RunContext
from etl_core.services.file_service import FileService
from etl_core.strategies.reading.base import BaseReadingStrategy
from etl_core.utils.path_utils import get_files

class COMReadingStrategy(BaseReadingStrategy):

```
def __init__(self, file_service: FileService | None = None) -> None:
    self._file_service = file_service or FileService()

def read(self, context: RunContext) -> list[str]:
    files = get_files(context.config_path, context.config_pattern)
    data = self._file_service.read_files(files)
    return [d.lower() for d in data]
```

# ============================================================

# FILE: src/etl_core/pipelines/**init**.py

# ============================================================

# ============================================================

# FILE: src/etl_core/pipelines/base_pipeline.py

# ============================================================

from **future** import annotations

from abc import ABC, abstractmethod
from typing import Any

from etl_core.context.run_context import RunContext
from etl_core.exceptions.base_exception import ETLException
from etl_core.exceptions.error_codes import ErrorCode
from etl_core.logging.logger import get_logger
from etl_core.schemas.pipeline_result import PipelineResult
from etl_core.schemas.run_parameters import RunParameters

logger = get_logger(**name**)

class BasePipeline(ABC):

```
def __init__(self, run_parameters: RunParameters) -> None:
    self.context = RunContext(run_parameters)

@abstractmethod
def run(self) -> Any:
    """Subclasses implement the actual node orchestration here."""

def execute(self) -> PipelineResult:
    """Safe wrapper that always returns a uniform PipelineResult."""
    try:
        result = self.run()
        return PipelineResult.ok(result)

    except ETLException as exc:
        logger.exception("Pipeline business error")
        return PipelineResult.fail(
            error_code=exc.error_code,
            message=exc.message,
            details=exc.details,
        )

    except Exception as exc:
        logger.exception("Unexpected pipeline failure")
        return PipelineResult.fail(
            error_code=ErrorCode.UNKNOWN_ERROR,
            message="Unexpected system error occurred",
            details={"error": str(exc)},
        )

@classmethod
def run_with(
    cls,
    config_path: str,
    config_pattern: str,
    run_env: str,
    root: str,
    expected_run_date: str,
    temp_file_path: str,
    directory: str = "TTRControls",
    test_run: bool = False,
) -> PipelineResult:
    params = RunParameters(
        config_path=config_path,
        config_pattern=config_pattern,
        run_env=run_env,
        directory=directory,
        root=root,
        expected_run_date=expected_run_date,
        test_run=test_run,
        temp_file_path=temp_file_path,
    )
    return cls(params).execute()
```

# ============================================================

# FILE: src/etl_core/pipelines/qa_pipeline.py

# ============================================================

from **future** import annotations

from typing import Any

from etl_core.logging.logger import get_logger
from etl_core.nodes.filter import FilterNode
from etl_core.nodes.reading import ReadingNode
from etl_core.nodes.transform import TransformNode
from etl_core.pipelines.base_pipeline import BasePipeline
from etl_core.strategies.reading.qa_reading import QAReadingStrategy

logger = get_logger(**name**)

class QAPipeline(BasePipeline):

```
def run(self) -> Any:
    logger.info("Starting QA Pipeline")

    data = ReadingNode(self.context, QAReadingStrategy()).run()
    data = FilterNode().run(data)
    data = TransformNode().run(data)

    logger.info("QA Pipeline finished")
    return data
```

# ============================================================

# FILE: src/etl_core/pipelines/com_pipeline.py

# ============================================================

from **future** import annotations

from typing import Any

from etl_core.logging.logger import get_logger
from etl_core.nodes.filter import FilterNode
from etl_core.nodes.harmonise import HarmoniseNode
from etl_core.nodes.reading import ReadingNode
from etl_core.nodes.transform import TransformNode
from etl_core.pipelines.base_pipeline import BasePipeline
from etl_core.strategies.reading.com_reading import COMReadingStrategy

logger = get_logger(**name**)

class COMPipeline(BasePipeline):

```
def run(self) -> Any:
    logger.info("Starting COM Pipeline")

    data = ReadingNode(self.context, COMReadingStrategy()).run()
    data = FilterNode().run(data)
    data = TransformNode().run(data)
    data = HarmoniseNode().run(data)

    logger.info("COM Pipeline finished")
    return data
```

# ============================================================

# FILE: tests/conftest.py

# ============================================================

import pytest
from pathlib import Path

@pytest.fixture()
def sample_dir(tmp_path: Path) -> Path:
“”“Create a temp directory with sample text files.”””
(tmp_path / “a.txt”).write_text(“Hello World\n”, encoding=“utf-8”)
(tmp_path / “b.txt”).write_text(”  \n”, encoding=“utf-8”)
(tmp_path / “c.txt”).write_text(“foo bar\n”, encoding=“utf-8”)
return tmp_path

# ============================================================

# FILE: tests/test_qa_pipeline.py

# ============================================================

from etl_core.pipelines.qa_pipeline import QAPipeline

def test_qa_pipeline_success(sample_dir):
result = QAPipeline.run_with(
config_path=str(sample_dir),
config_pattern=”*.txt”,
run_env=“test”,
root=“controls”,
expected_run_date=“2025-01-15”,
temp_file_path=”/tmp/etl”,
)
assert result.success is True
assert “HELLO WORLD” in result.data[0]

def test_qa_pipeline_missing_path(tmp_path):
result = QAPipeline.run_with(
config_path=str(tmp_path / “nonexistent”),
config_pattern=”*.txt”,
run_env=“test”,
root=“controls”,
expected_run_date=“2025-01-15”,
temp_file_path=”/tmp/etl”,
)
assert result.success is False
assert result.error_code is not None

# ============================================================

# FILE: tests/test_com_pipeline.py

# ============================================================

from etl_core.pipelines.com_pipeline import COMPipeline

def test_com_pipeline_success(sample_dir):
result = COMPipeline.run_with(
config_path=str(sample_dir),
config_pattern=”*.txt”,
run_env=“test”,
root=“controls”,
expected_run_date=“20250115”,
temp_file_path=”/tmp/etl”,
)
assert result.success is True
assert all(d.startswith(“HARMONISED::”) for d in result.data)

# ============================================================

# FILE: tests/test_run_parameters.py

# ============================================================

import pytest
from etl_core.schemas.run_parameters import RunParameters

def test_computed_fields(tmp_path):
# tmp_path exists, but we use a string path for config_path
params = RunParameters(
config_path=str(tmp_path),
config_pattern=”*.csv”,
run_env=“prod”,
root=“controls”,
expected_run_date=“2025-03-20”,
temp_file_path=”/tmp/etl”,
)
assert params.root_directory.endswith(”/controls”)
assert params.run_date == “2025-03-20”

def test_yyyymmdd_format(tmp_path):
params = RunParameters(
config_path=str(tmp_path),
config_pattern=”*.csv”,
run_env=“dev”,
root=“reports”,
expected_run_date=“20250320”,
temp_file_path=”/tmp/etl”,
)
assert params.run_date == “2025-03-20”

def test_invalid_date_rejected(tmp_path):
with pytest.raises(Exception):
RunParameters(
config_path=str(tmp_path),
config_pattern=”*.csv”,
run_env=“dev”,
root=“reports”,
expected_run_date=“2025/03/20”,
temp_file_path=”/tmp/etl”,
)
