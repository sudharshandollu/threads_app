from pathlib import Path
import datetime
from platform import system

system_path = system()  # assuming this is what you meant earlier


class ExecutionContext:
    def __init__(
        self,
        *,
        inputConfigFilePath: str,
        inputConfigFilePattern: str,
        rootFileDir: str,
        runEnv: str,
        expectedRunDate: str | None,
        tempFilePath: str | None,
    ):
        # ---------- RAW PARAMS ----------
        self.input_config_file_path_raw = inputConfigFilePath
        self.input_config_file_pattern = inputConfigFilePattern
        self.run_env = runEnv

        # ---------- DERIVED PARAMS ----------
        self.config_path = self._build_config_path(inputConfigFilePath)
        self.directory = self._extract_directory(inputConfigFilePath)
        self.root_directory = self._build_root_directory(rootFileDir)
        self.run_date = self._parse_run_date(expectedRunDate)
        self.temp_path = self._build_temp_path(tempFilePath)

        # ---------- EXECUTION STATE ----------
        self.current_step = None

        # ---------- DATA OWNERSHIP ----------
        self._data_df = {
            "src": None,
            "tgt": None,
            "combined": None
        }
        self._config_df = None

        self.metrics = {}

    # ========================
    # Param helpers (PRIVATE)
    # ========================

    def _build_config_path(self, config_path: str) -> str:
        return f"{system_path}/{config_path}"

    def _extract_directory(self, config_path: str) -> str:
        return Path(config_path).parts[2]

    def _build_root_directory(self, root_dir: str) -> str:
        return f"{system_path}/{root_dir}"

    def _parse_run_date(self, expected_run_date: str | None) -> datetime.datetime:
        if expected_run_date and len(expected_run_date) == 10:
            return datetime.datetime.strptime(expected_run_date, "%Y-%m-%d")
        return datetime.datetime.utcnow()

    def _build_temp_path(self, temp_path: str | None) -> str | None:
        if not temp_path:
            return None
        return f"{system_path}{temp_path}"
