// 英文词典分册(play 区域,2026-10-27 全站英文补齐)。键 = 界面上的中文原文,值 = 英文;tx.ts 合并进 ZH_EN。
export const ZH_EN_PLAY: Record<string, string> = {
  // AI 陪练 · 指法七关(lib/fingering COACH_STAGES:name/short)
  直加直减: "Direct add/sub", 满五加: "Add using 5", 破五减: "Subtract using 5", 进位加: "Add with carry",
  破五进位加: "Carry using 5", 退位减: "Subtract with borrow", 退位满五减: "Borrow using 5",
  // 指法类别(结果页「分笔指法」)
  直加: "Direct add", 直减: "Direct sub",
  // 口诀卡 · 判定
  "珠够,直接拨/直接去": "Enough beads: move them in or out directly",
  "下珠不够加,把5拨上来、去掉多余下珠(凑成5)": "Not enough lower beads to add: bring in the 5 bead and remove the extra lower beads (make 5)",
  "下珠不够减,把5拨走、还回若干下珠(拆开5)": "Not enough lower beads to subtract: take away the 5 bead and give back some lower beads (break the 5)",
  "本档满十、补数能直接去(6+5、8+2 也算本关)": "The rod reaches ten and the complement can be removed directly (6+5, 8+2 count too)",
  "满十,且去补数时下珠不够、必须拆5(如 5+7、6+6)": "Reaches ten, but removing the complement means breaking the 5 (e.g. 5+7, 6+6)",
  "本档不够减,退1还补数(12−5 还的正是5珠,也算本关)": "Not enough on this rod: borrow 1 and add back the complement (12−5 adds back the 5 bead itself; counts too)",
  "退1后还补数时下珠不够、要借5(如 12−6、12−7)": "After borrowing 1, not enough lower beads to add the complement: use the 5 (e.g. 12−6, 12−7)",
  // 口诀卡 · 口诀
  "不借不拆,拨珠即得": "No borrowing, no breaking: just move the beads",
  "加X下5去(5−X)": "+X: add 5, remove (5−X)",
  "减X去5还(5−X)": "−X: remove 5, add back (5−X)",
  "加X去(10−X)进1": "+X: remove (10−X), carry 1",
  "加X上(X−5)去5进1": "+X: add (X−5), remove 5, carry 1",
  "减X退1还(10−X)": "−X: borrow 1, add back (10−X)",
  "减X退1上5去(X−5)": "−X: borrow 1, add 5, remove (X−5)",
  // 变式小课标签
  加1: "+1", 加2: "+2", 加3: "+3", 加4: "+4", 加6: "+6", 加7: "+7", 加8: "+8", 加9: "+9",
  减1: "−1", 减2: "−2", 减3: "−3", 减4: "−4", 减6: "−6", 减7: "−7", 减8: "−8", 减9: "−9",
  "8、7": "8, 7", "6、5": "6, 5", "4、3": "4, 3", "2、1": "2, 1",
};
