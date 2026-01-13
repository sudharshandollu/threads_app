#!/usr/bin/env python3

import sys
import json
import uuid
import logging

from control_platform.generic_comp.execution_context import ExecutionContext
from control_platform.generic_comp.completeness_control import CompletenessControl


def setup_logging(run_id: str):
    logging.basicConfig(
        level=logging.INFO,
        format=(
            "%(asctime)s | %(levelname)s | "
            "run_id=%(run_id)s | step=%(step)s | %(message)s"
        ),
    )

    old_factory = logging.getLogRecordFactory()

    def record_factory(*args, **kwargs):
        record = old_factory(*args, **kwargs)
        record.run_id = run_id
        record.step = "-"
        return record

    logging.setLogRecordFactory(record_factory)


def main():
    if len(sys.argv) != 2:
        print("Usage: run_control.py <params.json>")
        sys.exit(1)

    params_path = sys.argv[1]

    with open(params_path) as f:
        params = json.load(f)

    run_id = params.get("run_id", str(uuid.uuid4()))
    setup_logging(run_id)

    logger = logging.getLogger("control_platform")
    logger.info("CONTROL RUN STARTED")

    try:
        # -------------------------
        # Create ExecutionContext
        # -------------------------
        context = ExecutionContext(
            config_path=params["config_path"],
            config_pattern=params["config_pattern"],
            root_directory=params["root_directory"],
            run_env=params["run_env"],
            expected_run_date=params.get("expected_run_date"),
            temp_path=params.get("temp_path"),
            directory=params.get("directory"),
        )

        # -------------------------
        # Run control
        # -------------------------
        control = CompletenessControl(context)
        control.execute()

        logger.info("CONTROL RUN COMPLETED")
        sys.exit(0)

    except Exception:
        logger.exception("CONTROL RUN FAILED")
        sys.exit(2)


if __name__ == "__main__":
    main()
