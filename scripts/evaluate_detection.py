"""Offline evaluation of independently labeled JSONL; never run during source-only delivery."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'audit'))
from detection import metrics


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('dataset', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    raw = args.dataset.read_bytes()
    if len(raw) > 20 * 1024 * 1024:
        raise ValueError('Dataset exceeds 20 MiB')
    rows = [json.loads(line) for line in raw.decode('utf-8-sig').splitlines() if line.strip()]
    ids, scenarios, evaluation = set(), {}, []
    for row in rows:
        key = row['event_id']
        if key in ids:
            raise ValueError('Duplicate event in dataset')
        ids.add(key)
        if row['split'] not in {'train', 'evaluation'} or len(row.get('review_note', '').strip()) < 10 or not row.get('scenario'):
            raise ValueError('Independent labels need split/scenario/review_note')
        prior = scenarios.setdefault(row['scenario'], row['split'])
        if prior != row['split']:
            raise ValueError('Scenario leakage across train/evaluation')
        if row['split'] == 'evaluation':
            evaluation.append(row)
    if not evaluation:
        raise ValueError('No evaluation samples')
    result = {'dataset_sha256': hashlib.sha256(raw).hexdigest(), 'metrics': metrics(evaluation),
              'status': 'Measured from supplied labels; provenance requires independent review.'}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8') as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2)
    print('Evaluation saved. Do not treat synthetic fixtures as real-world performance.')


if __name__ == '__main__':
    main()
