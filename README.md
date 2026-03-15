from pydantic import BaseModel
from typing import Any, Optional, Dict

class NodeResponse(BaseModel):

    success: bool = True
    node: str
    data: Any = None
    records: Optional[int] = None
    details: Optional[Dict] = None





from abc import ABC, abstractmethod
from etl_core.schemas.node_response import NodeResponse
from etl_core.exceptions.base_exception import ETLException

class BaseNode(ABC):

    @abstractmethod
    def process(self, data):
        pass

    def run(self, data=None):

        try:

            result = self.process(data)

            return NodeResponse(
                node=self.__class__.__name__,
                data=result,
                records=len(result) if isinstance(result, list) else None
            )

        except ETLException:
            raise

        except Exception as e:

            raise ETLException(
                message="Node execution failed",
                error_code="NODE_FAILED",
                details={"node": self.__class__.__name__, "error": str(e)}
            ) from e







class ReadingNode(BaseNode):

    def __init__(self, context, strategy):

        self.context = context
        self.strategy = strategy

    def process(self, data=None):

        logger.info("Running ReadingNode")

        return self.strategy.read(self.context)



        
