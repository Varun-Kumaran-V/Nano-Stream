# Contributing to Nano-Stream

Thank you for your interest in Nano-Stream.

Nano-Stream is a research-oriented software project associated with a published
research paper. Contributions are welcome, particularly contributions that
improve correctness, reproducibility, documentation, testing, performance, or
future extensions of the framework.

## Before Contributing

Please:

1. Read the `README.md`.
2. Review the documentation under `docs/`.
3. Review the architecture described in `plans/blueprint.md`.
4. Understand the existing implementation before making changes.
5. Check existing issues and pull requests to avoid duplicated work.

## Development Workflow

1. Fork the repository.
2. Create a feature or fix branch.
3. Make your changes.
4. Run the relevant tests or validation scripts.
5. Update documentation when behavior or architecture changes.
6. Commit your changes with a clear commit message.
7. Open a pull request.

Example:

```bash
git checkout -b feature/your-feature
```

## Research Reproducibility

Changes that affect experimental results should clearly document:

- dataset or data-processing changes
- feature-selection changes
- model architecture changes
- training configuration changes
- random seeds where applicable
- evaluation methodology
- changes in reported metrics

Do not silently modify or replace published experimental results.

If a change produces different results from those reported in the associated
paper, clearly identify the change and the conditions under which the new
results were obtained.

## Datasets

Large datasets used by Nano-Stream are not stored in this repository.

Do not commit:

- raw CIC-IDS2017 data
- CSE-CIC-IDS2018 data
- generated large dataset files
- unrelated datasets

Follow the dataset acquisition and preparation instructions in the README.

## Model Artifacts

Small model checkpoints that are explicitly part of the research release may
be included when appropriate.

Do not commit:

- temporary checkpoints
- unrelated experiments
- unnecessarily duplicated model artifacts
- large generated files without a documented reason

## Code Quality

Prefer:

- clear and readable Python code
- focused changes
- meaningful variable and function names
- reproducible experiments
- explicit configuration
- documentation for non-obvious behavior

Avoid introducing dependencies or architectural changes without a clear reason.

## Documentation

If a contribution changes:

- file behavior
- inputs or outputs
- execution order
- model architecture
- data flow
- deployment behavior
- experiment methodology

update the relevant documentation under `docs/`.

## Pull Requests

A pull request should:

- have a clear purpose
- describe the changes made
- explain any research or behavioral impact
- include relevant testing information
- update documentation when necessary

Please keep unrelated changes out of the same pull request whenever possible.

## Questions and Discussions

For general questions, reproducibility problems, or technical discussions,
open a GitHub issue with enough context for the problem to be understood
without relying on private background informatio

# Contributing to Nano-Stream

Thank you for your interest in Nano-Stream.

Nano-Stream is a research-oriented software project associated with a
published research paper. Contributions are welcome, particularly those that
improve reproducibility, correctness, documentation, testing, performance, or
future extensions of the framework.

## Before Contributing

Please:

1. Read the `README.md`.
2. Review the architecture documentation under `docs/`.
3. Understand the existing implementation before making changes.
4. Check existing issues and pull requests to avoid duplicated work.

## Development Workflow

1. Fork the repository.
2. Create a feature or fix branch.
3. Make your changes.
4. Run the relevant tests or validation scripts.
5. Update documentation when behavior or architecture changes.
6. Commit your changes with a clear commit message.
7. Open a pull request.

Example:

```bash
git checkout -b feature/your-feature
```
