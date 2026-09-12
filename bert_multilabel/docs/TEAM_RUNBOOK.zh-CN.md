# 组员操作手册：使用现成权重、运行网页、复现训练

## 1. 查看结果，不运行代码

先读英文 mentor review 或中文训练报告，再查看 `model_metadata/training_history.json`、
`ml/reports/bert-multilabel-base-v1/metrics.json` 和 `predictions.csv`。
八标签 Macro-F1 不是二分类 Macro-F1；网页 risky 汇总指标另列在报告中。

## 2. 获取源代码与训练后权重

```powershell
git clone --branch Leo --single-branch https://github.com/Raj14326/BeforeYouAgree---Beta.git
cd BeforeYouAgree---Beta/bert_multilabel
```

从 Release 下载训练后 ZIP，或使用完整交付包中的相同 ZIP。核验：

```powershell
Get-FileHash 'C:/path/to/BeforeYouAgree-Multilabel-LEGAL-BERT-Base-Weights.zip' -Algorithm SHA256
```

应为 `f546f98128af5dd0138d691353a26ad7c56e214d8fb0555c055b5c475eb0f931`。
解压到项目 `ml/models/`；目录必须是：

```text
bert_multilabel/ml/models/bert-multilabel-base-v1/model.safetensors
bert_multilabel/ml/models/bert-multilabel-base-v1/risk_config.json
```

必须保留整个模型目录中的 9 个文件，包括 tokenizer、config、阈值与训练曲线。
不要把 `model_metadata/` 当成模型，它只含审阅证据，没有权重。

## 3. 安装环境

需要 Node 22.22.2/24.15 或符合 package.json 的版本，以及 Python。
实际训练与本机测试使用 Windows、Python 3.14.4、PyTorch 2.14.0+cpu、
Transformers 4.57.6、8 CPU threads。`requirements-tested-win-py314.txt` 记录该环境。
其他机器可使用 Python 3.12+ 与范围 requirements；不同版本/设备不能保证
训练出的浮点结果逐 bit 相同。

```powershell
npm ci
py -3.14 -m venv .venv
.venv/Scripts/python.exe -m pip install -r ml_service/requirements.txt
```

没有 Python 3.14 时，换成安装的 Python 3.12/3.13 版本；它们需要单独验证。
若 npm 因缓存目录不可写失败，尝试 `npm ci --cache .npm-cache`。
若 PowerShell 阻止 ps1 脚本，可使用 `powershell -ExecutionPolicy Bypass -File ./start-public-model.ps1`
单次启动，不必改全局策略。

## 4. 启动：两个终端

终端 A，项目根目录：

```powershell
./start-public-model.ps1
```

等待出现 `Application startup complete`。
健康检查：http://127.0.0.1:8000/health 应返回 ready。

终端 B，相同目录：

```powershell
./start-web.ps1
```

打开 http://localhost:5173 。Node API 在 http://127.0.0.1:8787 。
先搜索服务、获取条款，再点 Analyse risks。模型返回八类分数与独立判定；
网页显示风险类别、需要复核标记，并按 offset 高亮原句。
上游 ToS;DR/GitHub 检索需要网络。仅 BERT 推理可用下面的本地文本测试：

```powershell
$body = @{content='We may terminate your account at any time without notice. You may close your own account at any time. Disputes must be resolved by binding arbitration.'} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api/analyze' -Method Post -ContentType 'application/json' -Body $body
```

预期三句中第一句命中单方终止、第二句不命中八类、第三句命中仲裁。
这只是接口 smoke test，不代替封存测试集的评估。

## 5. 复现训练（不必每个组员都做）

```powershell
.venv/Scripts/python.exe -m pip install -r ml_service/requirements-training.txt
./download-legal-bert-base.ps1
./train-multilabel.ps1
```

训练脚本默认保存到 `ml/models/bert-multilabel-base-v1` 并拒绝覆盖非空目录。
若你已解压交付权重，复制训练脚本并把 `--output` 及后续评估 `--model` 改为
新的目录，例如 `ml/models/bert-multilabel-base-reproduction`；不要删除已交付模型。
CPU 训练可能需要数小时；CUDA 设备需在命令中显式使用 `--device cuda` 并安装兼容环境。
公开 CSV 已在仓库中，读取时检查 manifest SHA-256。重新导入公开数据可运行
`python -m ml_service.prepare_public_data --output ml/data/lexglue-reimport`，
以新目录保存，不覆盖现有审阅数据。

训练只用 validation 选择 epoch/阈值。团队若继续调参，不应反复用已查看的 test
挑选策略；应另外建立未查看的外部服务测试集。

## 6. 测试与常见错误

```powershell
npm run build
npm run test:unit
.venv/Scripts/python.exe -m pytest ml_service/test_pipeline.py ml_service/test_public_data.py -q
npx playwright install chromium
npm run test:acceptance:local -- e2e/bert-results.spec.ts
```

交付前验证：build 通过；6 Node tests、13 Python tests、3 browser tests 通过。

- 503 / not ready：检查权重目录、模型服务启动日志与 Python /health。
- Connection refused：Python 8000 服务未启动或 BERT_SERVICE_URL 不正确。
- Too many clauses/windows：缩小输入，系统不会静默截断或把未分析部分当安全。
- GitHub push 文件过大：不要 `git add` 模型目录；权重应为 Release 附件。
- 没有风险标记：只表示八类均未过阈值，不代表合同法律安全。

## 7. 与团队主网站整合

Leo 中此目录是可运行集成示例，不会自动替换 main 网站。
在主网站的独立 PR 中审阅 `server/bert-model.ts`、`server/clauses.ts`、
`server/index.ts` 的 BERT 调用和 `src/App.vue` 的风险展示；保持检索/历史/样式不变。
部署额外 Python 服务，把 Node 的 BERT_SERVICE_URL 指向它。不要因 Leo 比 main
落后而直接把整份 main 合并或 force push；交由组内正常 review 流程处理。
