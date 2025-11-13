LABEL_PREFIX=$1
if [ -z  "$1" ]; then
    echo "Please provide an experiment label."
    exit 0
fi
REPETITION=$2

MODEL="gpt-3.5-turbo-0613"
PROMPT_FILE="prompts/system_msg_expbug.txt"
BUDGET="10"
NUM_TESTS="1"

trap 'echo interrupted; exit 1' INT

for rep in $(seq 1 "$REPETITION"); do
    label="${LABEL_PREFIX}${rep}"
    save_dir="results/${label}/${MODEL}"
    mkdir -p "${save_dir}"
    # Users should modify this script to iterate over their own bug names
    # Example: for bugname in your_bug_list; do
    #     save_file="${save_dir}/XFL-${bugname}.json"
    #     if [ -f ${save_file} ]; then
    #         echo "${save_file} exists"
    #         continue
    #     fi
    #     cmd="python autofl.py -m ${MODEL} -b ${bugname} -p ${PROMPT_FILE} -o ${save_file} --max_budget ${BUDGET} --max_num_tests ${NUM_TESTS} --show_line_number --postprocess_test_snippet --allow_multi_predictions --test_offset $((rep - 1))"
    #     echo ${cmd}
    #     timeout 10m ${cmd}
    # done
done
