```python
# ============================================================
# FILE: pyproject.toml
# ============================================================
"""
[project]
name = "etl-core"
version = "0.1.0"
description = "Reusable ETL framework"
dependencies = [
    "pydantic"
]

[tool.setuptools.packages.find]
where = ["src"]
"""

# ============================================================
# FILE: src/etl_core/logging/logger.py
# ============================================================

import logging
import sys

def setup_logging(level="INFO"):

    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )

def get_logger(name):
    return logging.getLogger(name)


# ============================================================
# FILE: src/etl_core/exceptions/error_codes.py
# ============================================================

from enum import Enum

class ErrorCode(str, Enum):

    FILE_NOT_FOUND = "FILE_NOT_FOUND"
    FILE_READ_ERROR = "FILE_READ_ERROR"
    INVALID_DATA = "INVALID_DATA"
    PIPELINE_FAILED = "PIPELINE_FAILED"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"


# ============================================================
# FILE: src/etl_core/exceptions/base_exception.py
# ============================================================

class ETLException(Exception):

    def __init__(self, message: str, error_code: str, details: dict | None = None):

        self.message = message
        self.error_code = error_code
        self.details = details or {}

        super().__init__(message)


# ============================================================
# FILE: src/etl_core/schemas/run_parameters.py
# ============================================================

from pydantic import BaseModel
from pathlib import Path

class RunParameters(BaseModel):

    path: Path
    pattern: str
    run_env: str


# ============================================================
# FILE: src/etl_core/schemas/error_response.py
# ============================================================

from pydantic import BaseModel
from typing import Optional, Dict

class ErrorResponse(BaseModel):

    success: bool = False
    error_code: str
    message: str
    details: Optional[Dict] = None


# ============================================================
# FILE: src/etl_core/context/run_context.py
# ============================================================

from etl_core.schemas.run_parameters import RunParameters

class RunContext:

    def __init__(self, params: RunParameters):

        self.params = params

    @property
    def path(self):
        return self.params.path

    @property
    def pattern(self):
        return self.params.pattern

    @property
    def run_env(self):
        return self.params.run_env


# ============================================================
# FILE: src/etl_core/utils/path_utils.py
# ============================================================

from pathlib import Path
from typing import List

from etl_core.logging.logger import get_logger

logger = get_logger(__name__)

def get_files(path: Path, pattern: str) -> List[Path]:

    logger.info(f"Searching files in {path} with pattern {pattern}")

    files = list(path.glob(pattern))

    logger.info(f"Found {len(files)} files")

    return files


# ============================================================
# FILE: src/etl_core/services/file_service.py
# ============================================================

from pathlib import Path
from typing import List

from etl_core.logging.logger import get_logger
from etl_core.exceptions.base_exception import ETLException
from etl_core.exceptions.error_codes import ErrorCode

logger = get_logger(__name__)

class FileService:

    def read_files(self, files: List[Path]) -> List[str]:

        if not files:

            raise ETLException(
                message="No input files found",
                error_code=ErrorCode.FILE_NOT_FOUND,
                details={"file_count": 0},
            )

        data = []

        for f in files:

            try:

                logger.info(f"Reading file {f}")

                data.append(f.read_text())

            except Exception as e:

                raise ETLException(
                    message="Failed to read file",
                    error_code=ErrorCode.FILE_READ_ERROR,
                    details={"file": str(f)},
                ) from e

        return data


# ============================================================
# FILE: src/etl_core/nodes/base.py
# ============================================================

from abc import ABC, abstractmethod
from typing import Any

class BaseNode(ABC):

    @abstractmethod
    def run(self, data: Any):
        pass


# ============================================================
# FILE: src/etl_core/strategies/reading/base.py
# ============================================================

from abc import ABC, abstractmethod

class BaseReadingStrategy(ABC):

    @abstractmethod
    def read(self, context):
        pass


# ============================================================
# FILE: src/etl_core/strategies/reading/qa_reading.py
# ============================================================

from etl_core.strategies.reading.base import BaseReadingStrategy
from etl_core.utils.path_utils import get_files
from etl_core.services.file_service import FileService

class QAReadingStrategy(BaseReadingStrategy):

    def read(self, context):

        files = get_files(context.path, context.pattern)

        service = FileService()

        return service.read_files(files)


# ============================================================
# FILE: src/etl_core/strategies/reading/com_reading.py
# ============================================================

from etl_core.strategies.reading.base import BaseReadingStrategy
from etl_core.utils.path_utils import get_files
from etl_core.services.file_service import FileService

class COMReadingStrategy(BaseReadingStrategy):

    def read(self, context):

        files = get_files(context.path, context.pattern)

        service = FileService()

        data = service.read_files(files)

        return [d.lower() for d in data]


# ============================================================
# FILE: src/etl_core/nodes/reading.py
# ============================================================

from etl_core.nodes.base import BaseNode
from etl_core.logging.logger import get_logger
from etl_core.exceptions.base_exception import ETLException

logger = get_logger(__name__)

class ReadingNode(BaseNode):

    def __init__(self, context, strategy):

        self.context = context
        self.strategy = strategy

    def run(self, data=None):

        logger.info("Running ReadingNode")

        try:

            result = self.strategy.read(self.context)

            logger.info("ReadingNode completed")

            return result

        except ETLException:

            logger.exception("ReadingNode business error")

            raise

        except Exception:

            logger.exception("Unexpected error in ReadingNode")

            raise


# ============================================================
# FILE: src/etl_core/nodes/filter.py
# ============================================================

from etl_core.nodes.base import BaseNode
from etl_core.logging.logger import get_logger

logger = get_logger(__name__)

class FilterNode(BaseNode):

    def __init__(self, context):

        self.context = context

    def run(self, data):

        logger.info("Running FilterNode")

        filtered = [d for d in data if d.strip()]

        logger.info(f"Filtered records: {len(filtered)}")

        return filtered


# ============================================================
# FILE: src/etl_core/nodes/transform.py
# ============================================================

from etl_core.nodes.base import BaseNode
from etl_core.logging.logger import get_logger

logger = get_logger(__name__)

class TransformNode(BaseNode):

    def __init__(self, context):

        self.context = context

    def run(self, data):

        logger.info("Running TransformNode")

        return [d.upper() for d in data]


# ============================================================
# FILE: src/etl_core/nodes/harmonis.py
# ============================================================

from etl_core.nodes.base import BaseNode
from etl_core.logging.logger import get_logger

logger = get_logger(__name__)

class HarmoniseNode(BaseNode):

    def __init__(self, context):

        self.context = context

    def run(self, data):

        logger.info("Running HarmoniseNode")

        return [f"HARMONISED::{d}" for d in data]


# ============================================================
# FILE: src/etl_core/pipelines/base_pipeline.py
# ============================================================

from abc import ABC, abstractmethod

from etl_core.schemas.run_parameters import RunParameters
from etl_core.context.run_context import RunContext
from etl_core.schemas.error_response import ErrorResponse
from etl_core.exceptions.base_exception import ETLException
from etl_core.exceptions.error_codes import ErrorCode
from etl_core.logging.logger import get_logger

logger = get_logger(__name__)

class BasePipeline(ABC):

    def __init__(self, run_parameters: RunParameters):

        self.context = RunContext(run_parameters)

    @abstractmethod
    def run(self):
        pass

    def execute(self):

        try:

            result = self.run()

            return {
                "success": True,
                "data": result
            }

        except ETLException as e:

            logger.exception("Pipeline business error")

            return ErrorResponse(
                error_code=e.error_code,
                message=e.message,
                details=e.details
            ).model_dump()

        except Exception as e:

            logger.exception("Unexpected pipeline failure")

            return ErrorResponse(
                error_code=ErrorCode.UNKNOWN_ERROR,
                message="Unexpected system error occurred",
                details={"error": str(e)}
            ).model_dump()

    @classmethod
    def run_with(cls, path, pattern, run_env):

        params = RunParameters(
            path=path,
            pattern=pattern,
            run_env=run_env
        )

        pipeline = cls(params)

        return pipeline.execute()


# ============================================================
# FILE: src/etl_core/pipelines/qa_pipeline.py
# ============================================================

from etl_core.pipelines.base_pipeline import BasePipeline
from etl_core.nodes.reading import ReadingNode
from etl_core.nodes.filter import FilterNode
from etl_core.nodes.transform import TransformNode

from etl_core.strategies.reading.qa_reading import QAReadingStrategy

from etl_core.logging.logger import get_logger

logger = get_logger(__name__)

class QAPipeline(BasePipeline):

    def run(self):

        logger.info("Starting QA Pipeline")

        reader = ReadingNode(self.context, QAReadingStrategy())
        filter_node = FilterNode(self.context)
        transform = TransformNode(self.context)

        data = reader.run()

        data = filter_node.run(data)

        data = transform.run(data)

        logger.info("QA Pipeline finished")

        return data


# ============================================================
# FILE: src/etl_core/pipelines/com_pipeline.py
# ============================================================

from etl_core.pipelines.base_pipeline import BasePipeline
from etl_core.nodes.reading import ReadingNode
from etl_core.nodes.filter import FilterNode
from etl_core.nodes.transform import TransformNode
from etl_core.nodes.harmonis import HarmoniseNode

from etl_core.strategies.reading.com_reading import COMReadingStrategy

from etl_core.logging.logger import get_logger

logger = get_logger(__name__)

class COMPipeline(BasePipeline):

    def run(self):

        logger.info("Starting COM Pipeline")

        reader = ReadingNode(self.context, COMReadingStrategy())
        filter_node = FilterNode(self.context)
        transform = TransformNode(self.context)
        harmonise = HarmoniseNode(self.context)

        data = reader.run()

        data = filter_node.run(data)

        data = transform.run(data)

        data = harmonise.run(data)

        logger.info("COM Pipeline finished")

        return data


# ============================================================
# FILE: src/etl_core/__init__.py
# ============================================================

from etl_core.logging.logger import setup_logging

setup_logging()
```
