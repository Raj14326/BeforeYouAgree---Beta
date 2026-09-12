"""Build a comparison only when both experiments used identical data splits."""
import argparse
import csv
import json
from pathlib import Path


def compare(bert_dir, nb_dir, model_dir, output):
    bert_dir, nb_dir, model_dir, output = map(Path, (bert_dir, nb_dir, model_dir, output))
    bert = json.loads((bert_dir / 'metrics.json').read_text(encoding='utf-8'))
    nb = json.loads((nb_dir / 'metrics.json').read_text(encoding='utf-8'))
    model = json.loads((model_dir / 'risk_config.json').read_text(encoding='utf-8'))
    if bert['test_sha256'] != nb['test_sha256'] or model['split_file_sha256'] != nb['split_file_sha256']:
        raise ValueError('Cannot compare results from different data splits')
    if bert['model'] != model['model_id']:
        raise ValueError('BERT report does not match selected checkpoint')
    fields = [('风险 Precision', 'risky_precision'), ('风险 Recall', 'risky_recall'),
              ('Macro-F1', 'macro_f1'), ('误报率', 'false_positive_rate'), ('Accuracy', 'accuracy')]
    lines = ['# 公开标注数据：BERT 与 NB 实测对比', '',
             '两者使用相同的训练、验证、测试 CSV；只在验证集选择模型及阈值。', '',
             '| 指标 | BERT | NB | BERT − NB（百分点） |', '| --- | ---: | ---: | ---: |']
    for label, key in fields:
        lines.append(f'| {label} | {bert[key]*100:.2f}% | {nb[key]*100:.2f}% | {(bert[key]-nb[key])*100:+.2f} |')
    lines += ['', '| 测试集条款数 | BERT | NB |', '| --- | ---: | ---: |']
    for label, key in [('正确识别风险 TP', 'tp'), ('误报 FP', 'fp'), ('漏报 FN', 'fn'), ('正确未标记 TN', 'tn')]:
        lines.append(f'| {label} | {bert["confusion"][key]} | {nb["confusion"][key]} |')
    lines += ['', f'BERT：{model.get("base_model_source", model["base_model"])}；选中 epoch {model["validation"]["epoch"]}，阈值 {model["threshold"]:.6f}。',
              f'评估 {bert["rows"]} 条的推理耗时：BERT {bert["seconds"]:.2f}s；NB {nb["seconds"]:.2f}s（不含模型加载，非网页端到端耗时）。',
              '', '本结果是公开数据集上的二分类比较，不是法律结论或对所有网站的效果保证。',
              '保留官方划分归属后去除了重复/冲突文本，因此不是原始 LexGLUE 排行榜设置，不能直接与排行榜分数比较。',
              '该发布版未提供文档 ID，无法独立验证文档级分组；官方句子级输入与网页段落输入也存在差异。',
              'NB 为本次重新训练的字符 3–5 gram 基线，不是旧 M006 权重。', '']
    output.mkdir(parents=True, exist_ok=True)
    (output / 'comparison.zh-CN.md').write_text('\n'.join(lines), encoding='utf-8')
    (output / 'comparison.json').write_text(json.dumps({'bert': bert, 'nb': nb}, indent=2), encoding='utf-8')
    def read_predictions(path):
        with path.open(encoding='utf-8-sig', newline='') as handle:
            return {row['clause_id']: row for row in csv.DictReader(handle)}
    b, n = read_predictions(bert_dir / 'predictions.csv'), read_predictions(nb_dir / 'predictions.csv')
    if b.keys() != n.keys():
        raise ValueError('Prediction IDs differ')
    with (output / 'disagreements.csv').open('w', encoding='utf-8-sig', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=['clause_id', 'text', 'actual', 'bert', 'nb', 'bert_error', 'nb_error'])
        writer.writeheader()
        for key, row in b.items():
            if row['predicted'] != n[key]['predicted']:
                writer.writerow({'clause_id': key, 'text': row['text'], 'actual': row['actual'],
                                 'bert': row['predicted'], 'nb': n[key]['predicted'],
                                 'bert_error': row['error'], 'nb_error': n[key]['error']})
    # Windows terminals may default to GBK; keep report UTF-8 on disk and make
    # console output portable.
    print('\n'.join(lines).replace('−', '-'))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bert', default='ml/reports/bert-public-v1')
    parser.add_argument('--nb', default='ml/reports/nb-public-v1')
    parser.add_argument('--model', default='ml/models/bert-public-v1')
    parser.add_argument('--output', default='ml/reports/public-comparison-v1')
    args = parser.parse_args()
    compare(args.bert, args.nb, args.model, args.output)
