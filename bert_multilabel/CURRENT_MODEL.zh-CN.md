# 当前模型配置与使用

这是已有 bert_multilabel 项目的模型更新包，不是独立网站源码。
将 UPLOAD_TO_LEO/bert_multilabel 中的文件按相同路径合并到 Leo 分支已有的
bert_multilabel 目录；先检查自己的修改，其他网页文件不需要替换。

当前模型：BYA-LEGAL-BERT-SMALL-8-20260913T092430Z。
LEGAL-BERT-Small；训练4轮、256 tokens、stride32、batch16；风险采样25%、
正类权重上限5；编码器LR2e-5、分类头LR1e-4；按验证Macro-F1选第
4轮；阈值F1且每类验证Recall>=70%。
八个独立阈值见CURRENT_MODEL_CONFIG.json或model_metadata/risk_config.json。

固定权重阈值比较未得到改善：保留原F1阈值，没有新的准确率提升。
历史测试风险二分类accuracy=95.81%，
precision=77.01%，recall=85.71%，
八标签Macro-F1=72.64%。测试集此前已查看，非新盲测。
新的独立标注数据尚未提供，独立确认未完成。

## 权重必须对应本版本

上传RELEASE_ASSET中的Small-256权重ZIP和WEIGHTS_SHA256.txt到新的Release，
建议标签leo-bert-small-256-v1，Target Leo。不要用旧Base或旧128-token Small
的Release权重替代这版。权重不提交普通Git仓库。

组员下载权重ZIP，解压到项目ml/models/，得到
ml/models/bert-multilabel-small-256-macrof1-v1/model.safetensors及所有配套文件。
model_metadata只是Git审阅材料，不是启动时读取的模型目录。

## 本机启动与复现

CPU启动运行start-current-small.ps1；另开窗口运行已有start-web.ps1。
GPU启动运行start-current-small.ps1 -Device cuda，需要.venv-gpu中CUDA PyTorch可用。
CPU可使用已有.venv；脚本优先使用.venv-gpu，无需激活环境。
不要使用会重设为旧Base的start-public-model.ps1。

重训使用train-small-256-macrof1.ps1；输出目录非空会拒绝覆盖。
重训时将脚本输出改为新目录，并相应修改评估命令。当前训练代码已支持
--selection-metric macro_f1；旧代码没有此参数，必须一起更新。

python -m ml_service.retune_thresholds可复现阈值比较，output和export目录需选择新名称。
完整阈值对照及八类验证分数见ml/reports/small-256-thresholds-v1/。

## Git提交说明

标题：Update current four-epoch 256-token LEGAL-BERT-Small configuration

说明：Keep the original F1 thresholds after a fixed-weight validation comparison.
Include exact model metadata, training reproduction, historical test results and
validation scores. Fresh independent evaluation remains pending. Model weights
are distributed separately through Releases. No deployment is changed by this upload.
