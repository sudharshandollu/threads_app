"""
========================================================
PROJECT STRUCTURE (src layout)
========================================================

etl-core/
│
├── pyproject.toml
│
├── src/
│   └── etl_core/
│
│       ├── __init__.py
│
│       ├── logging/
│       │       logger.py
│
│       ├── schemas/
│       │       run_parameters.py
│
│       ├── utils/
│       │       path_utils.py
│
│       ├── services/
│       │       file_service.py
│
│       ├── nodes/
│       │       base.py
│       │       reading.py
│       │       filter.py
│       │       transform.py
│       │       harmonis.py
│
│       ├── pipelines/
│       │       base.py
│       │       qa_pipeline.py
│       │       com_pipeline.py
│
└── tests/
"""

# =====================================================
# pyproject.toml
# =====================================================

"""
[project]
name = "etl-core"
version = "0.1.0"
dependencies = [
    "pydantic"
]

[tool.setuptools.packages.find]
where = ["src"]
"""

# =====================================================
# src/etl_core/logging/logger.py
# =====================================================

import logging
import sys


def setup_logging(level: str = "INFO"):

    logging.basicConfig(
        level=level,
        format=(
            "%(asctime)s | %(levelname)s | %(name)s | "
            "%(funcName)s | %(message)s"
        ),
        handlers=[logging.StreamHandler(sys.stdout)],
    )


def get_logger(name: str):
    return logging.getLogger(name)


# =====================================================
# src/etl_core/schemas/run_parameters.py
# =====================================================

from pydantic import BaseModel
from pathlib import Path


class RunParameters(BaseModel):
    path: Path
    pattern: str
    run_env: str


# =====================================================
# src/etl_core/utils/path_utils.py
# =====================================================

from pathlib import Path
from typing import List
from etl_core.logging.logger import get_logger

logger = get_logger(__name__)


def get_files(path: Path, pattern: str) -> List[Path]:

    logger.info("Searching files", extra={"path": str(path), "pattern": pattern})

    files = list(path.glob(pattern))

    logger.info(f"Found {len(files)} files")

    return files


# =====================================================
# src/etl_core/services/file_service.py
# =====================================================

from pathlib import Path
from typing import List
from etl_core.logging.logger import get_logger

logger = get_logger(__name__)


class FileService:

    def read_files(self, files: List[Path]) -> List[str]:

        logger.info("Starting file read")

        data = []

        for file in files:

            try:
                logger.debug(f"Reading file {file}")

                data.append(file.read_text())

            except Exception as e:

                logger.error(f"Failed reading file {file}: {e}")
                raise

        logger.info("Completed file reading")

        return data


# =====================================================
# src/etl_core/nodes/base.py
# =====================================================

from abc import ABC, abstractmethod
from typing import Any
from etl_core.logging.logger import get_logger

logger = get_logger(__name__)


class BaseNode(ABC):

    @abstractmethod
    def run(self, data: Any, **kwargs) -> Any:
        pass


# =====================================================
# src/etl_core/nodes/reading.py
# =====================================================

from typing import Any
from etl_core.nodes.base import BaseNode
from etl_core.schemas.run_parameters import RunParameters
from etl_core.utils.path_utils import get_files
from etl_core.services.file_service import FileService
from etl_core.logging.logger import get_logger

logger = get_logger(__name__)


class ReadingNode(BaseNode):

    def __init__(self):
        self.file_service = FileService()

    def run(self, data: Any, run_parameters: RunParameters):

        logger.info("Starting ReadingNode execution")

        try:

            files = get_files(run_parameters.path, run_parameters.pattern)

            contents = self.file_service.read_files(files)

            logger.info(
                f"ReadingNode completed successfully. Records: {len(contents)}"
            )

            return contents

        except Exception as e:

            logger.exception("ReadingNode failed")

            raise


# =====================================================
# src/etl_core/nodes/filter.py
# =====================================================

from typing import List
from etl_core.nodes.base import BaseNode
from etl_core.logging.logger import get_logger

logger = get_logger(__name__)


class FilterNode(BaseNode):

    def run(self, data: List[str], **kwargs) -> List[str]:

        logger.info("Starting FilterNode")

        try:

            filtered = [d for d in data if d.strip()]

            logger.info(f"FilterNode completed. Records: {len(filtered)}")

            return filtered

        except Exception:

            logger.exception("FilterNode failed")

            raise


# =====================================================
# src/etl_core/nodes/transform.py
# =====================================================

from typing import List
from etl_core.nodes.base import BaseNode
from etl_core.logging.logger import get_logger

logger = get_logger(__name__)


class TransformNode(BaseNode):

    def run(self, data: List[str], **kwargs) -> List[str]:

        logger.info("Starting TransformNode")

        try:

            transformed = [d.upper() for d in data]

            logger.info("TransformNode completed")

            return transformed

        except Exception:

            logger.exception("TransformNode failed")

            raise


# =====================================================
# src/etl_core/nodes/harmonis.py
# =====================================================

from typing import List
from etl_core.nodes.base import BaseNode
from etl_core.logging.logger import get_logger

logger = get_logger(__name__)


class HarmoniseNode(BaseNode):

    def run(self, data: List[str], **kwargs) -> List[str]:

        logger.info("Starting HarmoniseNode")

        try:

            harmonised = [f"HARMONISED::{d}" for d in data]

            logger.info("HarmoniseNode completed")

            return harmonised

        except Exception:

            logger.exception("HarmoniseNode failed")

            raise


# =====================================================
# src/etl_core/pipelines/base.py
# =====================================================

from abc import ABC, abstractmethod
from etl_core.schemas.run_parameters import RunParameters
from etl_core.logging.logger import get_logger

logger = get_logger(__name__)


class BasePipeline(ABC):

    def __init__(self, run_parameters: RunParameters):
        self.run_parameters = run_parameters

    @abstractmethod
    def run(self):
        pass

    @classmethod
    def run_with(cls, path, pattern, run_env):

        params = RunParameters(
            path=path,
            pattern=pattern,
            run_env=run_env,
        )

        pipeline = cls(params)

        return pipeline.run()


# =====================================================
# src/etl_core/pipelines/qa_pipeline.py
# =====================================================

from etl_core.pipelines.base import BasePipeline
from etl_core.nodes.reading import ReadingNode
from etl_core.nodes.filter import FilterNode
from etl_core.nodes.transform import TransformNode
from etl_core.logging.logger import get_logger

logger = get_logger(__name__)


class QAPipeline(BasePipeline):

    def run(self):

        logger.info("QA Pipeline started")

        try:

            reader = ReadingNode()
            filter_node = FilterNode()
            transformer = TransformNode()

            data = reader.run(None, self.run_parameters)

            data = filter_node.run(data)

            data = transformer.run(data)

            logger.info("QA Pipeline completed successfully")

            return data

        except Exception:

            logger.exception("QA Pipeline failed")

            raise


# =====================================================
# src/etl_core/pipelines/com_pipeline.py
# =====================================================

from etl_core.pipelines.base import BasePipeline
from etl_core.nodes.reading import ReadingNode
from etl_core.nodes.filter import FilterNode
from etl_core.nodes.transform import TransformNode
from etl_core.nodes.harmonis import HarmoniseNode
from etl_core.logging.logger import get_logger

logger = get_logger(__name__)


class COMPipeline(BasePipeline):

    def run(self):

        logger.info("COM Pipeline started")

        try:

            reader = ReadingNode()
            filter_node = FilterNode()
            transformer = TransformNode()
            harmoniser = HarmoniseNode()

            data = reader.run(None, self.run_parameters)

            data = filter_node.run(data)

            data = transformer.run(data)

            data = harmoniser.run(data)

            logger.info("COM Pipeline completed successfully")

            return data

        except Exception:

            logger.exception("COM Pipeline failed")

            raise


# =====================================================
# src/etl_core/__init__.py
# =====================================================

from etl_core.logging.logger import setup_logging
from etl_core.pipelines.qa_pipeline import QAPipeline
from etl_core.pipelines.com_pipeline import COMPipeline

setup_logging()

__all__ = [
    "QAPipeline",
    "COMPipeline",
]


# =====================================================
# Example Usage
# =====================================================

if __name__ == "__main__":

    from pathlib import Path
    from etl_core import QAPipeline, COMPipeline

    path = Path("./data")

    print("\n---- QA PIPELINE ----")

    qa_result = QAPipeline.run_with(
        path=path,
        pattern="*.txt",
        run_env="dev",
    )

    print(qa_result)

    print("\n---- COM PIPELINE ----")

    com_result = COMPipeline.run_with(
        path=path,
        pattern="*.txt",
        run_env="dev",
    )
