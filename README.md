# ============================================================
# FILE: src/control_platform/generic_comp/execution_context.py
# ============================================================

class ExecutionContext:
    def __init__(self, control_name: str, run_id: str):
        self.control_name = control_name
        self.run_id = run_id
        self.current_step = None

        # Namespaced shared state for parallel branches
        self.data = {
            "src": {},
            "tgt": {},
            "combined": {}
        }

        self.metrics = {}



# ============================================================
# FILE: src/control_platform/generic_comp/base_step.py
# ============================================================

import time
import logging

logger = logging.getLogger("control_platform")


class BaseStep:
    step_name = "base"

    def __init__(self, context):
        self.context = context

    def execute(self):
        raise NotImplementedError

    def run(self):
        self.context.current_step = self.step_name
        logger.info("STEP STARTED")

        start = time.time()
        try:
            result = self.execute()
            duration = time.time() - start
            logger.info(f"STEP COMPLETED | duration={duration:.2f}s")
            return result
        except Exception:
            logger.error("STEP FAILED", exc_info=True)
            raise
        finally:
            self.context.current_step = None



# ============================================================
# FILE: src/control_platform/generic_comp/utils.py
# ============================================================

def split_into_ranges(total_rows: int, chunk_size: int):
    ranges = []
    for start in range(0, total_rows, chunk_size):
        end = min(start + chunk_size, total_rows)
        ranges.append((start, end))
    return ranges



# ============================================================
# FILE: src/control_platform/generic_comp/steps/reading_config_comp_step.py
# ============================================================

from ..base_step import BaseStep

class ReadingConfigCompStep(BaseStep):
    step_name = "reading_config"

    def execute(self):
        # Example: load config / rules
        self.context.metrics["config_loaded"] = True



# ============================================================
# FILE: src/control_platform/generic_comp/steps/read_src_comp_step.py
# ============================================================

from ..base_step import BaseStep

class ReadSRCCompStep(BaseStep):
    step_name = "read_src"

    def execute(self):
        rows = self._read_src_metadata()
        self.context.data["src"]["rows"] = rows

    def _read_src_metadata(self):
        return 100000


# ============================================================
# FILE: src/control_platform/generic_comp/steps/pre_harmonisation_src_step.py
# ============================================================

from ..base_step import BaseStep

class PreHarmonisationSRCStep(BaseStep):
    step_name = "pre_harmonisation_src"

    def execute(self):
        self.context.metrics["src_pre_harmonised"] = True



# ============================================================
# FILE: src/control_platform/generic_comp/steps/harmonisation_src_step.py
# ============================================================

from ..base_step import BaseStep

class HarmonisationSRCStep(BaseStep):
    step_name = "harmonisation_src"

    def execute(self):
        self._apply_rules()
        self.context.metrics["src_harmonised"] = True

    def _apply_rules(self):
        pass


# ============================================================
# FILE: src/control_platform/generic_comp/steps/enrichment_file_search_src_step.py
# ============================================================

from ..base_step import BaseStep

class EnrichmentFileSearchSRCStep(BaseStep):
    step_name = "enrichment_file_search_src"

    def execute(self):
        self.context.data["src"]["enrichment_files"] = ["file1", "file2"]



# ============================================================
# FILE: src/control_platform/generic_comp/steps/enrichment_src_step.py
# ============================================================

from ..base_step import BaseStep

class EnrichmentSRCStep(BaseStep):
    step_name = "enrichment_src"

    def execute(self):
        self.context.metrics["src_enriched"] = True




# ============================================================
# FILE: src/control_platform/generic_comp/steps/post_enrichment_transform_src_step.py
# ============================================================

from ..base_step import BaseStep

class PostEnrichmentTransformSRCStep(BaseStep):
    step_name = "post_enrichment_transform_src"

    def execute(self):
        self.context.metrics["src_post_transform"] = True




# ============================================================
# FILE: src/control_platform/generic_comp/steps/read_tgt_comp_step.py
# ============================================================

from ..base_step import BaseStep

class ReadTGTCompStep(BaseStep):
    step_name = "read_tgt"

    def execute(self):
        rows = self._read_tgt_metadata()
        self.context.data["tgt"]["rows"] = rows

    def _read_tgt_metadata(self):
        return 95000



# ============================================================
# FILE: src/control_platform/generic_comp/steps/pre_harmonisation_tgt_step.py
# ============================================================

from ..base_step import BaseStep

class PreHarmonisationTGTStep(BaseStep):
    step_name = "pre_harmonisation_tgt"

    def execute(self):
        self.context.metrics["tgt_pre_harmonised"] = True



# ============================================================
# FILE: src/control_platform/generic_comp/steps/harmonisation_tgt_step.py
# ============================================================

from ..base_step import BaseStep

class HarmonisationTGTStep(BaseStep):
    step_name = "harmonisation_tgt"

    def execute(self):
        self.context.metrics["tgt_harmonised"] = True




# ============================================================
# FILE: src/control_platform/generic_comp/steps/enrichment_file_search_tgt_step.py
# ============================================================

from ..base_step import BaseStep

class EnrichmentFileSearchTGTStep(BaseStep):
    step_name = "enrichment_file_search_tgt"

    def execute(self):
        self.context.data["tgt"]["enrichment_files"] = ["fileA"]





# ============================================================
# FILE: src/control_platform/generic_comp/steps/enrichment_tgt_step.py
# ============================================================

from ..base_step import BaseStep

class EnrichmentTGTStep(BaseStep):
    step_name = "enrichment_tgt"

    def execute(self):
        self.context.metrics["tgt_enriched"] = True




# ============================================================
# FILE: src/control_platform/generic_comp/completeness_control.py
# ============================================================

import logging
from concurrent.futures import ThreadPoolExecutor

from .execution_context import ExecutionContext
from .steps.reading_config_comp_step import ReadingConfigCompStep

from .steps.read_src_comp_step import ReadSRCCompStep
from .steps.pre_harmonisation_src_step import PreHarmonisationSRCStep
from .steps.harmonisation_src_step import HarmonisationSRCStep
from .steps.enrichment_file_search_src_step import EnrichmentFileSearchSRCStep
from .steps.enrichment_src_step import EnrichmentSRCStep
from .steps.post_enrichment_transform_src_step import PostEnrichmentTransformSRCStep

from .steps.read_tgt_comp_step import ReadTGTCompStep
from .steps.pre_harmonisation_tgt_step import PreHarmonisationTGTStep
from .steps.harmonisation_tgt_step import HarmonisationTGTStep
from .steps.enrichment_file_search_tgt_step import EnrichmentFileSearchTGTStep
from .steps.enrichment_tgt_step import EnrichmentTGTStep
from .steps.post_enrichment_transform_tgt_step import PostEnrichmentTransformTGTStep

from .steps.combine_src_tgt_step import CombineSRCTGTStep
from .steps.apply_rec_rule_break_explain_step import ApplyRecRuleBreakExplainStep
from .steps.output_rule_step import OutputRuleStep
from .steps.break_rolling_delta_step import BreakRollingDeltaStep

logger = logging.getLogger("control_platform")


class CompletenessControl:
    def __init__(self, control_name: str, run_id: str):
        self.context = ExecutionContext(control_name, run_id)

        self.src_steps = [
            ReadSRCCompStep(self.context),
            PreHarmonisationSRCStep(self.context),
            HarmonisationSRCStep(self.context),
            EnrichmentFileSearchSRCStep(self.context),
            EnrichmentSRCStep(self.context),
            PostEnrichmentTransformSRCStep(self.context),
        ]

        self.tgt_steps = [
            ReadTGTCompStep(self.context),
            PreHarmonisationTGTStep(self.context),
            HarmonisationTGTStep(self.context),
            EnrichmentFileSearchTGTStep(self.context),
            EnrichmentTGTStep(self.context),
            PostEnrichmentTransformTGTStep(self.context),
        ]

        self.post_steps = [
            CombineSRCTGTStep(self.context),
            ApplyRecRuleBreakExplainStep(self.context),
            OutputRuleStep(self.context),
            BreakRollingDeltaStep(self.context),
        ]

    def _run_pipeline(self, steps):
        for step in steps:
            step.run()

    def execute(self):
        logger.info("CONTROL STARTED")

        ReadingConfigCompStep(self.context).run()

        # SRC & TGT in parallel
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [
                executor.submit(self._run_pipeline, self.src_steps),
                executor.submit(self._run_pipeline, self.tgt_steps),
            ]
            for f in futures:
                f.result()

        for step in self.post_steps:
            step.run()

        logger.info("CONTROL COMPLETED")

        return {
            "status": "SUCCESS",
            "metrics": self.context.metrics,
            "data": self.context.data,
        }









