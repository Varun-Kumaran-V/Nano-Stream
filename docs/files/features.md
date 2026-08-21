# features.json

## Purpose

`features.json` defines the canonical ordered feature schema used by the
Nano-Stream classifier.

It contains the 14 feature names expected by the ML pipeline.

## Features

1. `flow_duration`
2. `total_fwd_packets`
3. `total_bwd_packets`
4. `total_fwd_bytes`
5. `total_bwd_bytes`
6. `avg_fwd_pkt_len`
7. `avg_bwd_pkt_len`
8. `std_fwd_iat`
9. `mean_fwd_iat`
10. `pkt_rate`
11. `byte_rate`
12. `fwd_iat_total`
13. `min_pkt_size`
14. `tcp_flag_count_SYN`

## Input

No runtime input.

The file itself is a static JSON array.

## Output

A JSON list of feature names.

Python scripts load this list and use it to determine which columns of the
prepared dataset are supplied to the model.

## Upstream relationship

Raw CIC-IDS2017 column names are converted into these normalized names by:

    scripts/create_slice.py

For example:

    Flow Duration
        ↓
    flow_duration

## Downstream consumers

The feature schema is used by:

- `scripts/run_boruta.py`
- `train.py`

It also defines the intended model input contract for deployment.

## Important architectural property

The ordering of the features matters.

Nano-Stream's Tiny1DCNN treats the 14 values as an ordered one-dimensional
input sequence.

Therefore changing the order of these features after training can change the
meaning of the model input even if the same 14 feature names are present.

## Validation status

Check 2 confirmed:

- Valid JSON
- Exactly 14 features
- No duplicate feature names
- Names match the normalized columns expected by the preprocessing pipeline

## Known limitations

The file does not specify:

- feature data types
- expected units
- valid ranges
- normalization/scaling
- missing-value behavior
- runtime ordering validation

These should be considered for the future API/deployment version.

## V1 action

KEEP AS THE CANONICAL FEATURE SCHEMA.

Do not modify the feature order casually.
