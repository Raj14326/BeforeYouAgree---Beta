# 用公开标签训练 BERT，并与 NB 比较（旧二分类实验）

> 当前网页加载八标签 LEGAL-BERT-Base。正式流程、实际阈值和测试指标见 [MULTILABEL_TRAINING_REPORT.zh-CN.md](MULTILABEL_TRAINING_REPORT.zh-CN.md)。本文保留为旧二分类基线记录。

这条流程不要求团队人工制作标签，也不使用原有 500 条规则标签。使用 LexGLUE 的 UNFAIR-ToS 原始公开标注，映射为二分类。没有任一类别标签只代表“没有该数据集定义的八类标记”，不是法律安全保证。

## 数据与版本

- 数据：`coastalcph/lex_glue`，子集 `unfair_tos`。
- 固定版本：`c23fdff1a6bf74e0e1a71cb86f1e781d37da888c`。
- 数据卡：[LexGLUE](https://huggingface.co/datasets/coastalcph/lex_glue)，标注许可 CC-BY-4.0。
- 原始 train/validation/test：5532 / 2275 / 1607 条。
- 清理后：5378 / 2253 / 1600 条；其中风险条款 617 / 230 / 168 条。
- 清理方式：保留官方划分归属；完全重复文本优先保留 test，其次 validation，再 train；二分类标签冲突文本全部去除。所有变更及 SHA-256 记录在 `ml/data/lexglue-binary/dataset_manifest.json`。
- 该 parquet 发布没有文档或服务编号，不能宣称独立验证过文档分组。代码明确记录官方划分而不是编造 document_id。
- 因为清理和二分类转换，本结果不等同于原版多标签 LexGLUE 排行榜。

## 本轮模型

使用 `nlpaueb/legal-bert-small-uncased`，固定版本 `0e23f7a9a39f59768ea7e09766d8ee308580fb17`。选择 Small 是因为当前环境仅有 CPU；本轮更新整个编码器及分类头，是完整微调，不是只训练分类层。

配置：3 epochs、batch size 16、学习率 2e-5、最大窗口 128 tokens、重叠 32 tokens、类别权重、随机种子 5120。模型及阈值只通过验证集选择，目标为验证 recall 至少 0.70，然后优先 precision，再比较 macro-F1。0.70 是选择目标，不是测试集性能承诺。

NB 重新使用同样三个 CSV 训练，字符 3–5 gram CountVectorizer + MultinomialNB；alpha 在 0.1、1、10 中由验证集选择。NB 的阈值在 log odds 上选择，避免概率四舍五入到 1.0 的问题。两者使用相同模型选择目标。NB 不是旧 M006 权重。

## 重现实验

在项目根目录 PowerShell 执行。首次训练需要联网下载公开数据与预训练权重，不上传条款到在线推理 API。

```powershell
.venv/Scripts/python.exe -m pip install -r ml_service/requirements-training.txt
.venv/Scripts/python.exe -m ml_service.prepare_public_data
```

如果包中已含清理后的 CSV，不要重复导入覆盖；可先运行审计：

```powershell
.venv/Scripts/python.exe -m ml_service.data --train ml/data/lexglue-binary/train.csv --validation ml/data/lexglue-binary/validation.csv --test ml/data/lexglue-binary/test.csv
```

使用公开模型名称进行新的训练（输出目录必须为空，请为后续实验换目录名）：

```powershell
.venv/Scripts/python.exe -m ml_service.train --train ml/data/lexglue-binary/train.csv --validation ml/data/lexglue-binary/validation.csv --test ml/data/lexglue-binary/test.csv --base-model nlpaueb/legal-bert-small-uncased --revision 0e23f7a9a39f59768ea7e09766d8ee308580fb17 --output ml/models/bert-public-v1 --epochs 3 --batch-size 16 --max-length 128 --stride 32 --threads 8 --min-recall 0.70
.venv/Scripts/python.exe -m ml_service.train_nb --train ml/data/lexglue-binary/train.csv --validation ml/data/lexglue-binary/validation.csv --test ml/data/lexglue-binary/test.csv
.venv/Scripts/python.exe -m ml_service.evaluate --model ml/models/bert-public-v1 --test ml/data/lexglue-binary/test.csv --output ml/reports/bert-public-v1
.venv/Scripts/python.exe -m ml_service.compare
```

结果：`ml/reports/public-comparison-v1/comparison.zh-CN.md`，并提供双方预测明细及分歧条款。若数据哈希不一致，比较脚本会拒绝输出排名。不要根据测试集反复选模型。

## 运行网页

训练结束后，终端 A：

```powershell
$env:BERT_MODEL_DIR = 'ml/models/bert-public-v1'
$env:BERT_DEVICE = 'cpu'
.venv/Scripts/python.exe -m uvicorn ml_service.app:app --host 127.0.0.1 --port 8000 --workers 1
```

终端 B：

```powershell
$env:BERT_SERVICE_URL = 'http://127.0.0.1:8000'
npm.cmd run dev:full
```

公开标签训练的模型不会标为 weak-label experimental，不需要 `BERT_ALLOW_EXPERIMENTAL`。完整模型目录含 `model.safetensors`、tokenizer、`risk_config.json` 等，必须一起部署。

## 结果应怎样理解

测试集比较能说明模型在这个英文条款数据集上的效果，不能代表所有隐私政策、中文条款或当前网站新版本。训练数据是句子级，网页可能输入长段落；重叠窗口确保覆盖，但不能自动消除这种分布差异。当前保留二分类；如要展示八种风险类别，需要另外训练多标签分类头。

## 来源

- [LexGLUE 项目与任务定义](https://github.com/coastalcph/lex-glue)
- [LEGAL-BERT-Small 模型卡](https://huggingface.co/nlpaueb/legal-bert-small-uncased)
- Lippi et al., CLAUDETTE / UNFAIR-ToS；Chalkidis et al., LexGLUE。

分发数据和模型时请保留下载的原始数据/模型说明及其许可和引用信息。`human_reviewed` 保留为团队审核字段；公开标签通过单独的来源清单和文件哈希识别，未伪装为团队人工审核。
