// 上架应用商店用的隐私政策 / 用户协议 / 关于(2026-11-08 用户「准备安卓上架,没准备的都准备好」)。
// ⚠️ 下面三项由用户提供后填写,填好把 LEGAL_READY 改 true —— App 首次启动的隐私同意弹窗才会出现(没填之前不弹,免得老用户看到「待填」)。
export const LEGAL = {
  operator: "【待填:运营主体公司全称】",
  icp: "【待填:APP 备案号】",
  email: "【待填:联系邮箱】",
  updated: "2026 年 11 月 8 日",
  updatedEn: "November 8, 2026",
  version: "v1",
};
export const LEGAL_READY = false;

type Sec = { h: string; p: string[] };
const O = () => LEGAL.operator, E = () => LEGAL.email;

export const privacyZh = (): Sec[] => [
  { h: "引言", p: [`「珠象」(网站 superbrainlab.org 及安卓 / iOS 应用,以下称「我们」或「珠象」)由 ${O()} 运营。我们非常重视您和孩子的个人信息保护。本政策说明我们收集哪些信息、为什么收集、如何使用和保护,以及您享有的权利。请您(若用户未满 14 周岁,请由监护人)仔细阅读。`] },
  { h: "一、我们收集的信息", p: [
    "1. 账号信息:注册时的邮箱、您设置的昵称;用于登录、找回密码、在排行榜显示昵称。",
    "2. 训练与学习数据:每道题的题目、作答、对错、用时,训练成绩与进度,作业、班级(教练 / 学生关系)等;用于记录进度、生成学情、错题重做、排行榜。",
    "3. 比赛报名信息(仅在您报名珠象比赛时):选手姓名、手机号、身份证号、年龄(按身份证自动计算)、照片、学校 / 机构、组别和项目;用于报名审核、赛场身份核对、成绩公布。身份证号与照片仅主办方可见,不会公开显示。",
    "4. 语音作答(仅当您主动使用「语音作答」时):您说出答案的录音片段会发送到语音识别服务转成数字,识别后不保存录音。",
    "5. 设备与日志信息:为保障服务正常运行,服务器会记录访问时间、请求地址等必要日志。我们不收集通讯录、短信、位置、设备标识(IMEI 等),应用仅申请网络权限。",
  ] },
  { h: "二、我们如何使用信息", p: ["仅用于提供与改进珠心算训练、作业、等级鉴定、出题与比赛等服务;不用于广告,不出售任何个人信息,不做个性化广告推荐。"] },
  { h: "三、第三方服务与数据存储地", p: [
    "为提供服务,我们使用以下第三方服务处理必要数据:",
    "• Supabase(数据库与账号服务,服务器位于美国):存储账号与训练数据;",
    "• Netlify(网站托管与云函数,美国):承载网站、比赛报名数据;",
    "• 火山引擎(语音合成,中国):把题目文字合成为报题语音,只发送题目文字,不含个人信息;",
    "• OpenAI(语音识别,美国):仅在您使用语音作答时处理录音片段。",
    "上述部分服务器位于中国境外。使用本服务即表示您(或监护人)同意将上述信息传输至境外处理;我们与服务商均采取加密传输(HTTPS)等安全措施。",
  ] },
  { h: "四、儿童个人信息保护", p: ["珠象面向少年儿童提供珠心算训练。未满 14 周岁的儿童,应由监护人阅读并同意本政策后使用;比赛报名须由选手本人或监护人勾选同意。我们只收集提供服务所必需的儿童信息,监护人可随时联系我们查阅、更正或删除孩子的信息。"] },
  { h: "五、信息保存与安全", p: ["账号与训练数据在您使用服务期间保存;注销账号后我们将删除或匿名化处理您的个人信息(法律法规另有规定的除外)。比赛报名信息在比赛结束、成绩公布后由主办方按需保存。我们采用加密传输、访问权限控制等措施保护数据。"] },
  { h: "六、您的权利", p: [
    "• 查阅与更正:登录后可查看训练记录、修改昵称;",
    "• 注销账号:应用或网站内「账号菜单 → 注销账号」,或访问 superbrainlab.org/account/delete,确认后立即删除账号及训练数据;",
    `• 其他请求(如撤回同意、删除比赛报名信息)请联系 ${E()},我们将在 15 个工作日内处理。`,
  ] },
  { h: "七、政策更新与联系我们", p: [`本政策更新时我们会在应用内提示。运营者:${O()};联系邮箱:${E()};APP 备案号:${LEGAL.icp}。更新日期:${LEGAL.updated}。`] },
];

export const privacyEn = (): Sec[] => [
  { h: "Introduction", p: [`Zhuxiang (superbrainlab.org and the Android / iOS apps, "we") is operated by ${O()}. This policy explains what we collect, why, how we protect it, and your rights. If the user is under 14, a parent or guardian should read and accept it.`] },
  { h: "1. Information we collect", p: [
    "• Account: email and nickname — for login, password reset and leaderboards.",
    "• Practice data: problems, answers, correctness, time, scores, progress, homework and class (coach/student) — to track progress and show learning reports.",
    "• Contest registration (only if you register for a contest): name, phone, national ID number, age (derived from the ID), photo, school, group and events — for registration review, identity check at the venue and publishing results. ID numbers and photos are visible only to the organizer and never shown publicly.",
    "• Voice answers (only if you use voice answering): a short audio clip is sent to a speech-recognition service and is not stored.",
    "• Minimal server logs needed to run the service. We do not collect contacts, SMS, location or device identifiers; the app only requests network access.",
  ] },
  { h: "2. How we use it", p: ["Only to provide and improve abacus training, homework, certification, worksheet and contest features. No advertising, no sale of personal data."] },
  { h: "3. Service providers and data location", p: ["Supabase (database & accounts, USA); Netlify (hosting & functions, USA); Volcano Engine (text-to-speech, China — problem text only); OpenAI (speech recognition, USA — only when voice answering is used). Data is encrypted in transit (HTTPS)."] },
  { h: "4. Children", p: ["Zhuxiang is designed for children learning mental abacus. Children under 14 should use it with a parent's consent. Parents may contact us at any time to access, correct or delete their child's information. We show no ads and use no ad-tracking SDKs."] },
  { h: "5. Retention & deletion", p: ["Data is kept while your account is active. Delete your account any time in the app (Account menu → Delete account) or at superbrainlab.org/account/delete; your account and practice data are deleted immediately."] },
  { h: "6. Contact", p: [`Operator: ${O()} · Email: ${E()} · Last updated: ${LEGAL.updatedEn}.`] },
];

export const termsZh = (): Sec[] => [
  { h: "一、服务内容", p: [`「珠象」由 ${O()} 提供,包括珠心算训练、AI 陪练、作业、等级鉴定、出题系统和比赛系统等。部分功能需购买账号后使用,价格以官网和正式合同为准。`] },
  { h: "二、账号", p: ["您应提供真实有效的注册信息并妥善保管账号密码;未满 14 周岁的用户应在监护人同意和指导下使用。您可以随时注销账号。"] },
  { h: "三、使用规范", p: ["不得利用本服务从事违法活动,不得干扰服务正常运行,不得在比赛中作弊或冒用他人身份,不得批量抓取或转售题目与内容。"] },
  { h: "四、知识产权", p: ["珠象的软件、出题引擎、指法讲解、语音、界面设计等知识产权归运营者所有;用户生成的训练数据归用户所有。"] },
  { h: "五、免责与服务变更", p: ["我们尽力保证服务稳定,但因网络、第三方服务等原因造成的中断,我们将尽快修复。我们可能根据需要调整功能,重大变更会提前公告。"] },
  { h: "六、适用法律与联系", p: [`本协议适用中华人民共和国法律。如有问题请联系 ${E()}。更新日期:${LEGAL.updated}。`] },
];
export const termsEn = (): Sec[] => [
  { h: "1. Service", p: [`Zhuxiang is provided by ${O()}: abacus training, AI coach, homework, certification, worksheets and contests. Some features require a paid account.`] },
  { h: "2. Accounts", p: ["Keep your login safe. Users under 14 should use the service with a parent's consent. You can delete your account at any time."] },
  { h: "3. Acceptable use", p: ["No unlawful use, no disrupting the service, no cheating or impersonation in contests, no scraping or reselling content."] },
  { h: "4. Intellectual property", p: ["The software, problem engine, lessons, audio and design belong to the operator; your practice data belongs to you."] },
  { h: "5. Contact", p: [`Questions: ${E()}. Last updated: ${LEGAL.updatedEn}.`] },
];
