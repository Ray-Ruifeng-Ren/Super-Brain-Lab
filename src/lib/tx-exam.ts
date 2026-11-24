// 英文词典分册(exam 区域,2026-10-27 全站英文补齐)。键 = 界面上的中文原文,值 = 英文;tx.ts 合并进 ZH_EN。
// 只翻界面:卷面(标题、考号/姓名、答案页、PDF/Excel 内容、文件名)是给珠协用的中文正式试卷,两种语言下都保持中文。
export const ZH_EN_EXAM: Record<string, string> = {
  // 出题系统首页
  "等级鉴定 · 比赛题型": "Grading & Competitions", 自定义出题: "Custom", 等级鉴定: "Grading", 比赛题型: "Competitions",
  "点级别直接出整套试卷（A4 / B4） · 可调张数、单项、字号 · 打印、下载 PDF 或 Excel · 右上角二维码扫码看答案":
    "Tap a level for a full paper (A4 / B4) · adjust sheets, sections, font size · print or download PDF / Excel · scan the QR code (top right) for answers",
  "珠算技术等级鉴定（2021年最新标准）": "Abacus Grading (2021 standard)",
  "珠心算等级鉴定（2021年最新标准）": "Mental Abacus Grading (2021 standard)",
  世界珠心算比赛: "World Mental Arithmetic Competition", 全国珠心算比赛: "National Mental Arithmetic Competition",
  按第九届模拟题样卷: "per the 9th edition sample papers", 按全国比赛样题: "per the national sample papers",
  加减算: "Add/Sub", 乘算: "Multiply", 除算: "Divide", 全卷: "Full paper",
  // 自定义出题
  "自己定位数、笔数、小数；默认加减每张 20 题、乘除 60 题，想省纸可以调大每张题数，预览里选张数后打印或下载": "Set digits, terms and decimals. By default add/sub has 20 per sheet and multiply/divide 60; raise the count to save paper. Choose the number of sheets in the preview, then print or download",
  类型: "Type", 整数: "Integers", 两位小数: "2 decimals", 预览试卷: "Preview paper",
  // 预览弹窗
  张数: "Sheets", 套数: "Sets", 张: "sheets", 套: "sets", 起始编号: "Start no.", 手写体: "Handwritten", 黑体: "Sans",
  换一批: "New set", 取消: "Cancel", 打印: "Print", 打印失败: "Print failed",
  "鉴定标准:正文字体采用国际通用的手写体或黑体": "Grading standard: body text in the standard handwritten or sans-serif font",
  "版面按 A4 排,B4 整页等比放大": "Laid out for A4; B4 scales the whole page up",
  "第一次下载会让你选保存文件夹,之后直接保存": "First save asks for a folder",
  更改: "Change", 现在选: "Choose now",
  "点 PDF / Excel 直接保存,不再弹「另存为」": "PDF / Excel now save directly, no “Save as” dialog",
  "PDF / 打印与预览逐页一致;Excel 方便再编辑(每套含试题和答案)": "PDF / print match the preview page for page; Excel is editable (each set has questions + answers)",
};
