# AutoFL

> LLM-based Explainable Fault Localization Tool

# Environmental Setup
## Python Dependencies
- Compatible with Python >= 3.10
- Compatible with `openai>=1.0.0` (supports latest OpenAI API)

This project uses [uv](https://github.com/astral-sh/uv) for dependency management.

### Install uv (if not already installed)

```shell
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Install Dependencies

의존성을 설치하는 방법:

**방법 1: uv 사용 (권장)**

```shell
# 의존성 설치
uv sync

# 실행
python autofl.py --repo_path /path/to/repo --test_command "pytest" -o result.json
```

**방법 2: pip 사용**

```shell
# 의존성 설치
pip install pandas python-dotenv tqdm markdown2 tiktoken "openai>=0.27.8,<=0.28.1" javalang-ext scipy numpy matplotlib jupyter seaborn nbformat

# 실행
python autofl.py --repo_path /path/to/repo --test_command "pytest" -o result.json
```

## OpenAI API Setup
Before using AutoFL, set up your OpenAI API credentials by creating a `.env` file with the following content:

```shell
OPENAI_API_KEY={YOUR_API_KEY}
OPENAI_ORG_KEY={YOUR_ORG_KEY} # Optional
OPENAI_MODEL=gpt-4.1 # Optional, default is gpt-4.1
```
Replace `{YOUR_API_KEY}` with your OpenAI API key and `{YOUR_ORG_KEY}` with your organization's API key.

The `OPENAI_MODEL` variable allows you to set the default LLM model. If not specified, it defaults to `gpt-4.1`. You can still override it using the `-m` or `--model` command-line argument.

# General Usage

## Run AutoFL

AutoFL can analyze any repository by providing the repository path and test command.

### Basic Usage

```shell
python autofl.py \
  --repo_path /path/to/your/repository \
  --test_command "pytest" \
  -o result.json
```

### Required Arguments:
- `--repo_path`: Path to the repository root directory
- `--test_command`: Command to run tests (e.g., `pytest`, `mvn test`, `python -m pytest`)

### Optional Arguments:
- `-m, --model`: LLM model to use (default: `gpt-3.5-turbo-0613`)
- `-b, --bug_name`: Name/identifier for the project (default: `my_project`)
- `-o, --out`: Output file path (default: `test.json`)
- `-p, --prompt`: Path to system prompt file (default: `prompts/system_msg_expbug.txt`)
- `--language`: Programming language - `auto`, `java`, or `python` (default: `auto`)
- `--max_budget`: Maximum number of API calls (default: 10)
- `--max_num_tests`: Maximum number of tests to use
- `--allow_multi_predictions`: Allow multiple method predictions
- `--show_line_number`: Show line numbers in code snippets
- `--postprocess_test_snippet`: Post-process test snippets
- `--debug`: Enable debug mode

## Examples

### Python Project with Pytest

```shell
python autofl.py \
  --repo_path /path/to/python/project \
  --test_command "pytest" \
  --language python \
  -b my_python_project \
  -o python_result.json
```

This will save the analysis result to `python_result.json`.

### Java Project with Maven

```shell
python autofl.py \
  --repo_path /path/to/java/project \
  --test_command "mvn test" \
  --language java \
  -b my_java_project \
  -o java_result.json \
  --max_budget 15 \
  --allow_multi_predictions
```

## Output Format

The output JSON file contains:
- `time`: Timestamp of execution
- `success`: Whether the analysis succeeded
- `messages`: Complete conversation history with LLM
- `interaction_records`: Detailed step-by-step interaction records
- `buggy_methods`: Predicted buggy method signatures
- `predictions`: Raw prediction text from LLM
- `error`: Error message if the analysis failed

If you want to run multiple analyses, simply execute the command multiple times with different output file names:

```shell
# First run
python autofl.py --repo_path /path/to/repo --test_command "pytest" -o result_1.json

# Second run
python autofl.py --repo_path /path/to/repo --test_command "pytest" -o result_2.json

# Third run
python autofl.py --repo_path /path/to/repo --test_command "pytest" -o result_3.json
```
