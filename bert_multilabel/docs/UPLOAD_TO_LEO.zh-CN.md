# 将 BERT 交付上传到个人 Leo 分支

目标仓库：https://github.com/Raj14326/BeforeYouAgree---Beta  
目标分支：**Leo**  
核对时的分支提交：`5e893d673803a2402a12a3b3db2702f02ab3105c`

## 为什么采用独立目录

核对时 Leo 只有 `ml_baseline/`、`predict_risk.py`、`run_risk_model_experiments.py`
和旧 M006 说明，没有网站源码。此次新增 `bert_multilabel/` 作为完整模型与网页
集成示例，**不删除、不覆盖 Leo 中任何已有文件**。旧 NB 结果留作对比。
这一步不会合并 main，也不会改 main 的网站部署。后续把模型接入团队主网站时，
另开 PR，只审核模型接口和风险结果展示的差异。

## 方法 A：网页上传代码（容易操作）

1. 解压完整 ZIP，找到 `UPLOAD_TO_LEO/bert_multilabel/`。
2. 打开 https://github.com/Raj14326/BeforeYouAgree---Beta/tree/Leo 。
3. 再次确认左上角分支选择器显示 **Leo**。
4. 点击文件列表附近的 `+` 或 `Add file` → `Upload files`。
5. 将完整的 **bert_multilabel 文件夹**拖入上传区域。不要拖入外层交付 ZIP，
   不要拖入 `RELEASE_ASSET` 或权重 ZIP。
6. 检查待提交文件路径均以 `bert_multilabel/` 开头。
7. Commit message：`Add eight-label LEGAL-BERT training and integration`。
8. 选择直接提交到 **Leo**；如果界面要求创建新分支或你没有写权限，先联系仓库管理员，
   不要改为提交 main。完成后检查 Leo 里出现 `bert_multilabel/README.md`。

## 方法 B：用 Git 上传（推荐，文件多时更可靠）

安装 Git 后，在准备存放仓库的位置打开 PowerShell：

```powershell
git clone --branch Leo --single-branch https://github.com/Raj14326/BeforeYouAgree---Beta.git
cd BeforeYouAgree---Beta
git branch --show-current
```

结果必须是 `Leo`。把 `UPLOAD_TO_LEO/bert_multilabel` 复制到克隆仓库根目录。
随后运行：

```powershell
git status --short
git add -- bert_multilabel
git diff --cached --stat
git commit -m "Add eight-label LEGAL-BERT training and integration"
git push origin Leo
```

首次登录按 Git Credential Manager 的浏览器提示授权。不要把 token 写入脚本。
`git status` 应只出现新增的 `bert_multilabel/`。若它已存在，先检查冲突，
不要盲目覆盖；这份交付只以核对时上述提交为基准。

如果你使用已有克隆，先保存/提交自己的工作，再运行 `git fetch origin`、
`git switch Leo`、`git pull --ff-only origin Leo`。如果 fast-forward 失败，
停止并检查分支差异，不要 force push，也不要运行 reset 删除工作。

## 权重上传：放 GitHub Release，不放普通 Git 提交

训练后权重 ZIP 约 440 MB，普通 GitHub 仓库会拒绝超过 100 MiB 的文件。

1. 先把上面的代码提交成功。
2. 仓库右侧 Releases → `Create a new release`。
3. 新 tag：`leo-bert-base-v1`；**Target 选择 Leo**。
4. 标题：`Leo: LEGAL-BERT-Base eight-label model v1`。
5. 上传 `RELEASE_ASSET/BeforeYouAgree-Multilabel-LEGAL-BERT-Base-Weights.zip`
   和 `RELEASE_ASSET/WEIGHTS_SHA256.txt`。复制同目录的 release notes 到描述框。
6. 发布后，用实际 tag 确认下载地址可用：

```text
https://github.com/Raj14326/BeforeYouAgree---Beta/releases/download/leo-bert-base-v1/BeforeYouAgree-Multilabel-LEGAL-BERT-Base-Weights.zip
```

该链接在你实际发布 Release 前不存在。Release 是仓库级附件，tag 指向 Leo 的
提交，不等于将代码合并到 main。仓库目前公开，文档和发布权重也将公开。

## 给 mentor 与组员的查阅入口

上传后分享以下路径对应的 GitHub 页面（你自行发送，无需给每人重新训练）：

- `Leo/bert_multilabel/README.md`：总览。
- `docs/MENTOR_REVIEW.en.md`：英文审阅顺序与检查点。
- `docs/TRAINING_METHOD.en.md`：训练方法、数据、限制。
- `docs/TRAINING_REPORT.zh-CN.md`：中文完整训练报告。
- `docs/TEAM_RUNBOOK.zh-CN.md`：组员克隆、安装、运行和排错。
- `model_metadata/`：权重配置、真实训练曲线、八个阈值。
- `ml/reports/bert-multilabel-base-v1/`：测试指标及每句预测。

文档使用 Markdown，GitHub 可直接渲染，不需要安装 Word。

官方规则：
https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
