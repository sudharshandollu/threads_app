def _parse_run_date(self, date_str):
        if date_str and len(date_str) == 10:
            return datetime.datetime.strptime(date_str, "%Y-%m-%d")
        return datetime.datetime.utcnow()





# src/control_platform/generic_comp/steps/reading_config_comp_step.py

from ..base_step import BaseStep

# Import your existing business functions
from ..utils import (
    read_input_src_tgt_config,
    input_file_searching_operations,
)


class ReadingConfigCompStep(BaseStep):
    step_name = "reading_config"

    def execute(self):
        ctx = self.context

        # -------------------------
        # STEP 1: READ CONFIG
        # -------------------------
        (
            input_files_src_df,
            input_files_tgt_df,
            control_config_df,
            log_file_path,
            log_df,
        ) = read_input_src_tgt_config(
            ctx.config_path,
            ctx.config_pattern,
            ctx.run_env,
            ctx.root_directory,
            ctx.temp_path,
            ctx.run_date,
            ctx.directory,
        )

        # Store config + logs
        ctx._config_df = control_config_df
        ctx._log_df = log_df
        ctx.log_file_path = log_file_path

        # -------------------------
        # STEP 2: FILE SEARCH
        # -------------------------
        (
            input_files_src_df,
            input_files_tgt_df,
            control_df,
            log_df,
        ) = input_file_searching_operations(
            input_files_src_df,
            input_files_tgt_df,
            control_config_df,
            ctx.run_date,
            log_df,
            ctx.run_env,
            ctx.root_directory,
            log_file_path,
        )

        # -------------------------
        # STORE RESULTS
        # -------------------------
        ctx._data_df["src"] = input_files_src_df
        ctx._data_df["tgt"] = input_files_tgt_df
        ctx._config_df = control_df
        ctx._log_df = log_df

        # -------------------------
        # METRICS
        # -------------------------
        ctx.metrics["config_loaded"] = True
        ctx.metrics["src_files_count"] = len(input_files_src_df)
        ctx.metrics["tgt_files_count"] = len(input_files_tgt_df)
