# Specialist model creation, LoRA and Colibri

## Independent specialist models
Create and independently qualify small language models (SLMs) or role-specific adapters for defined semantic tasks. Establish a baseline using deterministic methods and unadapted inference. Domain examples can come from approved, provenance-tracked lexicons and labeled research evidence. Partition training, validation and held-out test sets by underlying task or source family to avoid leakage.

## LoRA training
LoRA (low-rank adaptation) changes a small set of trainable parameters rather than updating all base-model weights. Record base model and license, dataset versions, training configuration, adapter version, evaluation scope, and comparison against baseline. Qualify each specialist in isolation; test interactions when composed. Retrain only when measured deficiencies justify it. No completed training results are claimed.

## Colibri
Colibri is the planned inference service boundary. The inventoried interface includes model listing, health and chat-completion endpoints. A bounded Intellectus-side coordinator selects a model and version, carries scoped evidence, and records response identity, timing and resource usage. Serving capacity and actual adapter capabilities must be measured. Inference output is a candidate claim, not verified evidence.

## Qualification
Measure correctness, unsupported-claim rate, counterexample detection, held-out generalization, latency and memory. Compare base model, individual adapter, deterministic-only and composed configurations. Keep test oracles separate from training and acquisition. Preserve licenses and model/dataset provenance.
