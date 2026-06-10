"""Triton Python backend — sentiment logits from review text (demo)."""
import json
import numpy as np
import triton_python_backend_utils as pb_utils


POS = {"great", "excellent", "amazing", "love", "best", "wonderful"}
NEG = {"bad", "terrible", "awful", "boring", "waste", "worst", "hate"}


class TritonPythonModel:
    def initialize(self, args):
        self.model_config = json.loads(args["model_config"])

    def execute(self, requests):
        responses = []
        for request in requests:
            raw = pb_utils.get_input_tensor_by_name(request, "TEXT").as_numpy()[0]
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8")
            try:
                texts = json.loads(raw)
            except json.JSONDecodeError:
                texts = [str(raw)]
            logits = []
            for text in texts:
                words = set(str(text).lower().split())
                pos = len(words & POS)
                neg = len(words & NEG)
                logits.append([1.0 + neg * 0.5, 1.0 + pos * 0.5])
            out = pb_utils.Tensor("LOGITS", np.array(logits, dtype=np.float32))
            responses.append(pb_utils.InferenceResponse(output_tensors=[out]))
        return responses
