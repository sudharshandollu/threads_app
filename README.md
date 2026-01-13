# src/control_platform/generic_comp/steps/reading_config_comp_step.py

from ..base_step import BaseStep


class ReadingConfigCompStep(BaseStep):
    step_name = "reading_config"

    def execute(self):
        ctx = self.context

        # -------------------------
        # 1. Read config + rules
        # -------------------------
        (
            input_files_src_df,
            input_files_tgt_df,
            control_config_df,
            log_file_path,
            log_df,
        ) = self._read_input_src_tgt_config(
            ctx.config_path,
            ctx.config_pattern,
            ctx.run_env,
            ctx.root_directory,
            ctx.temp_path,
            ctx.run_date,
            ctx.directory,
        )

        ctx._config_df = control_config_df
        ctx._log_df = log_df
        ctx.log_file_path = log_file_path

        # -------------------------
        # 2. File searching logic
        # -------------------------
        (
            input_files_src_df,
            input_files_tgt_df,
            control_df,
            log_df,
        ) = self._input_file_searching_operations(
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
        # 3. Persist results
        # -------------------------
        ctx._data_df["src"] = input_files_src_df
        ctx._data_df["tgt"] = input_files_tgt_df
        ctx._config_df = control_df
        ctx._log_df = log_df

        # -------------------------
        # 4. Metrics
        # -------------------------
        ctx.metrics["config_loaded"] = True
        ctx.metrics["src_files_count"] = len(input_files_src_df)
        ctx.metrics["tgt_files_count"] = len(input_files_tgt_df)

    # ==========================================================
    # Step-specific business logic (PRIVATE)
    # ==========================================================

    def _read_input_src_tgt_config(
        self,
        config_path,
        config_pattern,
        run_env,
        root_directory,
        temp_path,
        run_date,
        directory,
    ):
        """
        Reads control configuration, rules, and initializes log DF.
        This logic is owned by ReadingConfigCompStep ONLY.
        """

        # ---- EXISTING LOGIC GOES HERE ----
        # (No refactor, just moved)

        # Placeholder – replace with your actual implementation
        input_files_src_df = ...
        input_files_tgt_df = ...
        control_config_df = ...
        log_file_path = ...
        log_df = ...

        return (
            input_files_src_df,
            input_files_tgt_df,
            control_config_df,
            log_file_path,
            log_df,
        )

    def _input_file_searching_operations(
        self,
        input_files_src_df,
        input_files_tgt_df,
        control_config_df,
        run_date,
        log_df,
        run_env,
        root_directory,
        log_file_path,
    ):
        """
        Performs input file discovery and validation.
        Owned by ReadingConfigCompStep.
        """

        # ---- EXISTING LOGIC GOES HERE ----
        # (Again, moved as-is)

        # Placeholder – replace with your actual implementation
        control_df = control_config_df

        return (
            input_files_src_df,
            input_files_tgt_df,
            control_df,
            log_df,
        )
