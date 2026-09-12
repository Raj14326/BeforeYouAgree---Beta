# Before You Agree 八标签 LEGAL-BERT-Base 训练报告

## 目标与最终结构

本版本直接预测 UNFAIR-ToS 的八个可同时成立的类别，不再先把句子转成关键词，也不再把八类训练标签压成一个二分类标签。网页用 `Intl.Segmenter` 按英文句子切分，Python 服务为每句输出八个 sigmoid 分数。每一类使用验证集独立选择的阈值；任意一类达到自己的阈值，该句即显示为风险句，并展示命中的类别。

八类依照 LexGLUE 官方顺序：

1. Limitation of liability（责任限制）
2. Unilateral termination（单方终止）
3. Unilateral change（单方变更）
4. Content removal（内容删除）
5. Contract by using（使用即同意）
6. Choice of law（法律选择）
7. Jurisdiction（管辖地）
8. Arbitration（仲裁）

## 数据来源与固定版本

- 数据集：[LexGLUE / UNFAIR-ToS](https://huggingface.co/datasets/coastalcph/lex_glue)，revision `c23fdff1a6bf74e0e1a71cb86f1e781d37da888c`，数据卡标注许可 `CC-BY-4.0`。
- 任务定义：[LexGLUE 官方仓库](https://github.com/coastalcph/lex-glue)。UNFAIR-ToS 包含 50 份在线服务条款，提供句子级八标签标注。
- 基础模型：[nlpaueb/legal-bert-base-uncased](https://huggingface.co/nlpaueb/legal-bert-base-uncased)，revision `15b570cbf88259610b082a167dacc190124f60f6`，模型卡标注许可 `CC-BY-SA-4.0`。
- 本地清理记录、源文件及导出文件 SHA-256：`ml/data/lexglue-binary/dataset_manifest.json`。

没有新增 AI 伪标签，也没有要求项目团队重新人工标注。训练直接使用公开数据原有的八标签。清理保留官方 split 归属，跨 split 的完全重复文本按 test、validation、train 的固定优先级只保留一份；同文异标记录全部剔除。

## 数据规模

| split | 句子数 | 至少一个风险标签 | 多标签句子 |
|---|---:|---:|---:|
| train | 5,378 | 617 | 62 |
| validation | 2,253 | 230 | 18 |
| test | 1,600 | 168 | 13 |

训练集各类正例数依次为 188、136、119、72、75、36、34、28。类别严重不均衡。直接按原始频率计算 28–191 倍的正类权重在试运行中导致模型几乎全报风险，因此正式运行改用每轮 50% 风险句、50% 无标签句的分层重采样；再按重采样后的类别频率计算 `pos_weight` 并封顶为 20。验证和测试仍保留真实类别分布。

## 训练方法

- 模型：12 层、768 hidden、12 attention heads 的 LEGAL-BERT-Base，加八维线性分类头。
- 目标：`BCEWithLogitsLoss`，八类可同时为 1。
- 全量微调：编码器与分类头全部更新。
- 参数：seed 5120，3 epochs，batch size 16，AdamW，编码器 learning rate `2e-5`，新分类头 `1e-4`，前 10% steps warm-up 后线性衰减，weight decay `0.01`，gradient clipping `1.0`，最大 128 tokens，stride 32。
- 长句：重叠 token window；每一类分别取所有 window 的最大 logit。训练与推理使用同一聚合。
- 模型选择：每轮结束在 validation 上为每一类独立搜索阈值，要求该类 recall 至少 0.70，然后优先最大化 F1、再最大化 precision。按 validation macro-F1、micro-F1 选择 checkpoint。
- test 在模型和阈值冻结后只评估一次，不参与选 epoch 或阈值。

可复现训练命令：

```powershell
py -3.12 -m venv .venv
.venv/Scripts/python.exe -m pip install -r ml_service/requirements-training.txt
./download-legal-bert-base.ps1
./train-multilabel.ps1
```

`download-legal-bert-base.ps1` 只下载上述固定 commit；`train-multilabel.ps1` 依次训练并用冻结阈值评估测试集。清理后的公开训练、验证和测试 CSV 已包含在源码包中。

## 实际训练结果

| epoch | train loss | validation macro-F1 | validation micro-F1 | 网页风险 precision | 网页风险 recall | 网页风险 F1 |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0.6040 | 0.7129 | 0.6949 | 0.7290 | 0.8304 | 0.7764 |
| 2 | 0.1271 | 0.7276 | 0.7311 | 0.7481 | 0.8391 | 0.7910 |
| 3 | 0.0458 | **0.7521** | **0.7615** | **0.7656** | **0.8522** | **0.8066** |

按预设规则选择 epoch 3，并将该轮八个验证集阈值写入 `risk_config.json`。

## 封存测试集结果

测试集共 1,600 句，只在模型和阈值冻结后评估一次：

- 八标签 macro-F1：**0.7469**
- 八标签 micro-precision / recall / F1：**0.7500 / 0.7459 / 0.7479**
- 八标签 exact match：**0.9500**
- 网页“任一类别命中即风险” precision / recall / F1：**0.8047 / 0.8095 / 0.8071**
- 网页风险误报率：**0.0230**；accuracy：**0.9594**
- 网页风险混淆矩阵：TP 136、FP 33、FN 32、TN 1,399

| 类别 | 独立阈值 | precision | recall | F1 | 测试正例数 |
|---|---:|---:|---:|---:|---:|
| Limitation of liability | 0.9668 | 0.7714 | 0.7297 | 0.7500 | 37 |
| Unilateral termination | 0.9400 | 0.8235 | 0.7568 | 0.7887 | 37 |
| Unilateral change | 0.9235 | 0.7500 | 0.6667 | 0.7059 | 36 |
| Content removal | 0.2499 | 0.5000 | 0.9167 | 0.6471 | 12 |
| Contract by using | 0.9964 | 1.0000 | 0.5217 | 0.6857 | 23 |
| Choice of law | 0.4512 | 1.0000 | 0.9231 | 0.9600 | 13 |
| Jurisdiction | 0.6979 | 0.9375 | 0.9375 | 0.9375 | 16 |
| Arbitration | 0.5943 | 0.3529 | 0.8571 | 0.5000 | 7 |

“仲裁”测试正例仅 7 条，F1 的不确定性明显高于大类；“使用即同意”测试 recall 为 0.5217。下一轮提升应优先补充这两个类别的真实标注样本并做跨服务外部验证。原始预测位于 `ml/reports/bert-multilabel-base-v1/predictions.csv`，指标位于同目录 `metrics.json`。

## 与旧二分类模型的同测试集比较

下面只比较最终网页的 risky/not-risky 汇总判定，三者使用相同的 1,600 条清理后测试句。八标签 macro-F1 与二分类 macro-F1 定义不同，不能直接横向比较。

| 模型 | risky precision | risky recall | risky F1 | accuracy |
|---|---:|---:|---:|---:|
| 字符 n-gram NB | 0.7168 | 0.7381 | 0.7273 | 0.9419 |
| 旧 LEGAL-BERT-Small 二分类 | **0.8514** | 0.7500 | 0.7975 | **0.9600** |
| 新 LEGAL-BERT-Base 八标签汇总 | 0.8047 | **0.8095** | **0.8071** | 0.9594 |

新模型相较旧二分类 BERT 提高 recall 5.95 个百分点和 risky F1 0.97 个百分点，precision 降低 4.66 个百分点，整体 accuracy 基本持平；同时它能说明命中了哪一类风险。是否采用这一取舍应依据产品对漏报和误报的成本决定。

第一次直接使用原始频率产生的 28–191 倍正类权重时，模型在前两轮几乎把所有验证句都判成风险，macro-F1 仅 0.032–0.033。该失败运行保存在 `ml/models/bert-multilabel-base-failed-unbalanced`，未被网页加载；它说明本任务不能仅靠无限增大类别权重处理长尾问题。

## 使用

```powershell
./start-public-model.ps1
npm run dev:full
```

模型服务默认读取 `ml/models/bert-multilabel-base-v1`。网页结果中的百分数是未校准分类分数，并非法律风险发生概率；模型只覆盖上述八类英文服务条款问题。
