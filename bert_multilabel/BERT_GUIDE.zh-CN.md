# Before You Agree：BERT 接入与训练

> 当前生产方案已升级为“八标签 + LEGAL-BERT-Base + 每类独立阈值 + 句子级推理”。请以 [MULTILABEL_TRAINING_REPORT.zh-CN.md](MULTILABEL_TRAINING_REPORT.zh-CN.md) 和 `train-multilabel.ps1` 为准；本文其余二分类内容保留用于理解旧版与兼容代码。

更新：团队选择使用现成公开标签。请优先阅读 [PUBLIC_TRAINING.zh-CN.md](PUBLIC_TRAINING.zh-CN.md)；下方关于 `human_reviewed=true` 的步骤仅适用于团队自己的标注 CSV。公开数据集通过独立来源清单验证，不需要团队重新人工标注。

本版本把网页的实际分析入口改为 BERT 服务，旧 M006 推理代码和权重已经移除。NB 仅保留为离线实验报告。没有经过微调的模型时，分析会明确失败，不会返回虚假的“没有风险”。

## 运行流程

Vue 页面 → Node `/api/analyze` → 保留原文位置的条款切分 → Python `/predict` → BERT 重叠窗口分类 → 原文高亮。

默认模型起点：`nlpaueb/legal-bert-base-uncased`，适用于英文文本。首次训练会下载预训练权重；它尚没有你们的风险分类能力，必须微调。代码没有调用付费推理 API，也不会把条款上传给 Hugging Face；训练及推理都在运行 Python 的机器上执行。

## 本次强化

- 完整条款输入，不提取关键词，不删除否定词、标点或条件表达。
- 段落与编号列表切分，保留短条款；长段落重叠窗口覆盖，不静默截掉末尾。
- 在训练和推理中均对窗口使用 max-logit 聚合，让模型学习“任一窗口有风险则整条需关注”。这是启发式聚合，仍需真实长条款测试，可能增加长条款误报。
- 按训练集类别频率加权交叉熵，处理类别不均衡。
- 在验证集最低召回约束下选择 precision 最好的阈值和 epoch。测试集不参与调参。
- 阈值附近标记待复核，网页可筛选。这个分数未做概率校准，待复核区间也只是可配置启发式，不代表法律风险概率或严谨的不确定性估计。
- 服务/文档分组与相同文本交叉泄漏检查；显式要求人工审核来源。
- 同一模型实例批量推理，限制并发和窗口数量，失败不回退到 NB。
- Node 生成 UTF-16 原文位置，Python 原样保留 clauseId，避免中英文、emoji 和重复文本造成高亮错位。

## 当前数据情况

工作区 `output/ota_priority_review_500_*_binary.csv` 共 500 条：训练 361、验证 69、测试 70，服务分组分别为 10、2、3。审计未发现跨集合服务名或完全相同的规范化文本，但 `human_reviewed=true` 为 0。CSV 写有规则辅助审核，不能据此宣称人工金标准或 BERT 效果提高。

这批数据是优先抽样的风险案例，风险比例很高，不能代表网站真实分布。正式模型应找回原有 UNFAIR-ToS 数据及标签映射，补充网站误报/漏报案例，并独立人工标注。隐私政策与其他新文档类型需要分别验证。相似文本、同集团不同服务名仍可能泄漏，自动检查无法完全解决。

## 1. 安装

在本项目根目录打开 PowerShell：

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r ml_service/requirements.txt
npm.cmd ci
```

GPU 训练建议使用带 CUDA 的 PyTorch 环境；本机 CPU 可以用于验证代码及小规模实验。Docker 示例使用 Python 3.12。`requirements.txt` 是兼容版本范围，发布时应保存实际环境的锁定版本。

## 2. 准备与审核数据

创建三个 UTF-8 CSV：`ml/data/train.csv`、`validation.csv`、`test.csv`。字段：

```text
document_id,clause_id,text,label,human_reviewed
```

`label` 必须是 `risky` 或 `not_risky`；每个集合必须有两类。`human_reviewed` 只有真实人工复核完成后才填 `true`。可增加 `service_name` 以按服务进行更严格隔离。已有 CSV 的 `clause_text_clean`、`binary_label` 也能读取。

不把服务名称拼入模型输入；保持训练与网页输入一致。相同条款应先去重并解决标签冲突，同一服务及其文档版本应在同一集合。

```powershell
.venv/Scripts/python.exe -m ml_service.data --train ml/data/train.csv --validation ml/data/validation.csv --test ml/data/test.csv
```

如仅探索现有弱标签数据，可传 `--allow-weak-labels`。生成模型将标记 `experimental=true`，线上默认拒绝加载；这是显式的实验开关，不是将弱标签变为人工标签。

## 3. 微调

```powershell
.venv/Scripts/python.exe -m ml_service.train --train ml/data/train.csv --validation ml/data/validation.csv --test ml/data/test.csv --output ml/models/bert-risk --epochs 3 --batch-size 4 --max-length 256 --stride 64 --min-recall 0.70
```

模型训练采用完整条款标签，超长条款拆成窗口后聚合计算损失，未将条款标签强行赋给每个窗口。超过每个训练批次 128 窗口时明确中止；减小 batch-size 或核查异常长文本，不会静默丢弃数据。

`--min-recall 0.70` 是初始可配置目标，不是性能承诺。模型选择仍可能受小验证集影响。使用 `--revision` 指定模型 commit 可以复现下载版本。输出目录非空会拒绝覆盖，请为新实验选新目录。

模型输出包括权重、tokenizer、`risk_config.json` 和 `training_history.json`，记录阈值、标签映射、数据哈希和验证结果。模型文件留在 `ml/models/`，不要提交大型权重进普通 Git。

## 4. 独立评估

```powershell
.venv/Scripts/python.exe -m ml_service.evaluate --model ml/models/bert-risk --test ml/data/test.csv --output ml/reports/bert-test
```

输出 `metrics.json` 和 `predictions.csv`，后者包含误报/漏报标识，便于人工检查。测试使用模型保存的阈值；需要改阈值时回到验证集，不能反复利用同一个测试集挑模型。

与 NB 比较前，要确认测试集没有进入 NB 的训练/调参数据。旧 JSON 中的历史指标与不同数据集上的 BERT 指标不能直接排名。重点比较 risky precision、recall、macro-F1、误报率，以及否定表达、例外条件、不同文档类型和整篇文档延迟。

## 5. 启动 Python 服务

终端 A：

```powershell
$env:BERT_MODEL_DIR = 'ml/models/bert-risk'
$env:BERT_DEVICE = 'cpu'
.venv/Scripts/python.exe -m uvicorn ml_service.app:app --host 127.0.0.1 --port 8000 --workers 1
```

加载成功时 `/health` 返回 200；权重缺失/不匹配返回 503。实验模型需要显式 `$env:BERT_ALLOW_EXPERIMENTAL = '1'`；只用于开发验证。

## 6. 启动网页与 Node

终端 B：

```powershell
$env:BERT_SERVICE_URL = 'http://127.0.0.1:8000'
npm.cmd run dev:full
```

打开 Vite 显示的地址，选取文档并点击 Analyse risks。新增 Needs review 筛选。服务不可用或输入超容量时显示失败，不把失败当作无风险。

`.env.bert.example` 是配置清单，Node 默认不会自动读取。远程部署时在平台环境变量中设置两端相同的 `BERT_API_KEY`，并使用私有网络。Node 的 `/api/health` 是 Node 存活检查，Python `/health` 才代表模型就绪。

## 部署

前端继续使用 Amplify 配置，Node 继续使用原来的 Railway 配置。Python 是独立服务；从项目根目录用 `ml_service/Dockerfile` 构建，挂载训练好的模型到 `/models/bert-risk`，设置 `BERT_SERVICE_URL` 连接 Node。服务使用单 worker 避免重复加载模型；模型目录不可用时健康检查失败。模型容量、CPU/GPU、内存和超时应通过真实文档压力测试确定。

每次请求最多 1000 个条款和 2048 个 token 窗口，Node 正文上限 500000 UTF-16 单元。过长输入应拆成多份，当前没有异步任务队列。max pooling 只在窗口范围内建模，不能理解任意远距离跨章节引用。中文或其他语言不在本候选英文模型的已验证范围。

## 验证代码

```powershell
npm.cmd run build
npm.cmd run test:unit
.venv/Scripts/python.exe -m pytest ml_service/test_pipeline.py -q
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.playwright-browsers'
node node_modules/playwright/cli.js install chromium --only-shell
npm.cmd run test:acceptance:local
```

Python 测试在临时目录创建极小随机 BERT，验证实际前向计算、长文本窗口、梯度、训练保存、加载和评估流程。它不是已训练的法律风险模型，不能用测试通过宣称识别准确率提高。页面原有验收测试使用模拟接口，也不是模型效果评估。

本次测试环境的 Python 依赖精确版本保存于 `ml_service/requirements-tested-win-py314.txt`；该文件用于记录 Windows / Python 3.14 的复现环境，其他平台先使用 `requirements.txt` 安装并验证兼容性。

## 参考

- https://huggingface.co/nlpaueb/legal-bert-base-uncased
- https://huggingface.co/docs/transformers/tasks/sequence_classification
- https://huggingface.co/docs/transformers/main/pad_truncation

LEGAL-BERT 模型卡标注 CC-BY-SA-4.0，分发模型时保留模型来源与适用许可说明。训练数据也需记录来源、标签定义和许可。
