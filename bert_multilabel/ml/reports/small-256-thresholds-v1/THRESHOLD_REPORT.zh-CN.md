# 固定权重阈值比较：未发现满足约束的改善

模型：`BYA-LEGAL-BERT-SMALL-8-20260913T092430Z`。未重新训练，原权重和原配置SHA-256均保持不变。
在2253条原验证样本上保存八类分数；只把content_removal和arbitration的阈值目标从F1改成F0.5，保留每类Recall至少70%，其他六类阈值不动。

**结论：两种目标选择完全相同的阈值，保留原F1配置。没有新的准确率提升。**

|类别|原阈值|F0.5阈值|验证Precision|验证Recall|验证误报|
|---|---:|---:|---:|---:|---:|
|content_removal|0.328816503|0.328816503|44.23%|71.88%|29|
|arbitration|0.576949835|0.576949835|30.43%|77.78%|16|

两套阈值的验证集指标完全相同：Macro-F1 73.21%，Micro-F1 72.79%，整体风险Precision 71.68%，Recall 86.96%，误报 79 条，漏报 30 条。这些是验证指标，不是此前1600条测试集指标。

## 为什么提高阈值没有被选择

- content_removal：下一个更高候选阈值 0.330769509，Recall 68.75%，误报 29 条、漏报 10 条。
- arbitration：下一个更高候选阈值 0.579061747，Recall 66.67%，误报 16 条、漏报 3 条。

完整候选阈值、Precision、Recall、F1、F0.5和混淆计数保存在两份precision_recall.csv。更高阈值可能减少误报，但不能隐瞒漏报增加；该分析没有使用旧测试集选参数。

## 新的独立确认：待提供数据

当前项目只有原训练、验证和历史测试集，没有新保留数据。不得将原测试重新命名为新测试，或把原数据重新切分后声称独立。
下一步需要未参与已有实验、可靠标注同八类的新条款；尽量来自不同服务。程序拒绝与已知三划分的规范化文本重复；已知训练服务ID可用时也检查服务重复，但原公开数据没有服务ID，因此还需人工确认来源独立，并检查近似重复。
文件格式见fresh_holdout_template.csv（只有表头，没有假数据）。只有实际人类标注/复核才可填写human_reviewed=true；公开专家标注需记录来源版本。original_labels为0至7的JSON列表，空列表代表无风险，label必须与其一致。
已有新数据时运行如下命令，输出目录需换新名称；它仍只用原验证集选阈值，之后才对新数据评分，不根据新数据重新选参数：

```powershell
& .\.venv-gpu\Scripts\python.exe -m ml_service.retune_thresholds --holdout "C:\path\fresh_holdout.csv" --output ml/reports/small-256-thresholds-fresh-v1 --export-model ml/models/small-256-thresholds-fresh-v1 --device cuda
```

## 使用与复现

当前继续使用ml/models/bert-multilabel-small-256-macrof1-v1，不必替换权重、不必创建新Release。导出的threshold-v1仅为比较副本，没有改善，暂不作为新版本上线。
源码入口ml_service/retune_thresholds.py；八项阈值与保留数据检查测试通过，验证分数和comparison.json可供mentor查阅。复现不带新数据时也须选择未存在的output和export目录。
