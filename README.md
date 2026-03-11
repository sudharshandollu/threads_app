# ================================
# file: control_framework/models/execution_context.py
# ================================

from dataclasses import dataclass

@dataclass
class ExecutionContext:
    request: dict
    data: dict | None = None
    result: dict | None = None


# ================================
# file: control_framework/core/step.py
# ================================

from abc import ABC, abstractmethod

class Step(ABC):

    @abstractmethod
    def run(self, context):
        pass


# ================================
# file: control_framework/core/base_executor.py
# ================================

class BaseExecutor:

    def __init__(self, steps):
        self.steps = steps

    def execute(self, context):

        for step in self.steps:
            step.run(context)

        return context.result


# ================================
# file: control_framework/steps/validate_step.py
# ================================

from control_framework.core.step import Step

class ValidateStep(Step):

    def run(self, context):
        print("Validating request")

        if "control_id" not in context.request:
            raise ValueError("control_id missing in request")


# ================================
# file: control_framework/steps/fetch_data_step.py
# ================================

from control_framework.core.step import Step

class FetchDataStep(Step):

    def run(self, context):
        print("Fetching data")

        # Simulated data fetch
        context.data = {"records": [10, 20, 30]}


# ================================
# file: control_framework/steps/compute_metrics_step.py
# ================================

from control_framework.core.step import Step

class ComputeMetricsStep(Step):

    def run(self, context):

        print("Computing metrics")

        records = context.data["records"]

        context.result = {
            "total": sum(records),
            "count": len(records)
        }


# ================================
# file: control_framework/steps/enrich_step.py
# ================================

from control_framework.core.step import Step

class EnrichStep(Step):

    def run(self, context):

        print("Enriching data")

        context.data["enriched"] = True


# ================================
# file: control_framework/steps/save_result_step.py
# ================================

from control_framework.core.step import Step

class SaveResultStep(Step):

    def run(self, context):

        print("Saving result")

        context.result = {
            "status": "saved",
            "data": context.data
        }


# ================================
# file: control_framework/executors/type1_executor.py
# ================================

from control_framework.core.base_executor import BaseExecutor
from control_framework.steps.validate_step import ValidateStep
from control_framework.steps.fetch_data_step import FetchDataStep
from control_framework.steps.compute_metrics_step import ComputeMetricsStep


class Type1Executor(BaseExecutor):

    def __init__(self):

        steps = [
            ValidateStep(),
            FetchDataStep(),
            ComputeMetricsStep()
        ]

        super().__init__(steps)


# ================================
# file: control_framework/executors/type2_executor.py
# ================================

from control_framework.core.base_executor import BaseExecutor
from control_framework.steps.validate_step import ValidateStep
from control_framework.steps.fetch_data_step import FetchDataStep
from control_framework.steps.enrich_step import EnrichStep
from control_framework.steps.save_result_step import SaveResultStep


class Type2Executor(BaseExecutor):

    def __init__(self):

        steps = [
            ValidateStep(),
            FetchDataStep(),
            EnrichStep(),
            SaveResultStep()
        ]

        super().__init__(steps)


# ================================
# file: control_framework/factory/executor_factory.py
# ================================

from control_framework.executors.type1_executor import Type1Executor
from control_framework.executors.type2_executor import Type2Executor


def get_executor(control_type: str):

    executors = {
        "type1": Type1Executor,
        "type2": Type2Executor
    }

    executor_class = executors.get(control_type)

    if not executor_class:
        raise ValueError(f"Unsupported control type: {control_type}")

    return executor_class()


# ================================
# file: run_control.py
# ================================

from control_framework.factory.executor_factory import get_executor
from control_framework.models.execution_context import ExecutionContext


if __name__ == "__main__":

    request = {
        "control_id": "CTR001",
        "start_date": "2024-01-01",
        "end_date": "2024-01-10"
    }

    context = ExecutionContext(request=request)

    executor = get_executor("type1")

    result = executor.execute(context)

    print("\nFinal Result:")
    print(result)





project-root/
│
├── pyproject.toml
├── README.md
├── .gitignore
│
├── src/
│   └── control_framework/
│       │
│       ├── __init__.py
│       │
│       ├── core/
│       │   ├── __init__.py
│       │   ├── base_executor.py
│       │   └── step.py
│       │
│       ├── models/
│       │   ├── __init__.py
│       │   └── execution_context.py
│       │
│       ├── steps/
│       │   ├── __init__.py
│       │   ├── validate_step.py
│       │   ├── fetch_data_step.py
│       │   ├── compute_metrics_step.py
│       │   ├── enrich_step.py
│       │   └── save_result_step.py
│       │
│       ├── executors/
│       │   ├── __init__.py
│       │   ├── type1_executor.py
│       │   └── type2_executor.py
│       │
│       └── factory/
│           ├── __init__.py
│           └── executor_factory.py
│
├── scripts/
│   └── run_control.py
│
└── tests/
    └── test_executor.py






