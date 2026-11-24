// 手机号国家/地区(2026-10-29 用户「只有 +86 和 +1,可以设置其他国家的吗」)。
// 账号底层仍是内部邮箱 <区号><号码>@phone.superbrainlab.org(与老 +86 / +1 账号同一规则,老账号不受影响)。
// 号码一律只留数字、去掉国内长途前缀 0(英国 07911… → 7911…)。

export const PHONE_DOMAIN = "phone.superbrainlab.org";

export interface PhoneCountry { id: string; code: string; flag: string; zh: string; en: string; min: number; max: number; re?: RegExp }

/** 常用国家/地区(中国大陆、美加在前,与老版本一致);"other" = 手动填区号 */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { id: "CN", code: "86", flag: "🇨🇳", zh: "中国大陆", en: "China", min: 11, max: 11, re: /^1[3-9]\d{9}$/ },
  { id: "US", code: "1", flag: "🇺🇸", zh: "美国/加拿大等", en: "US / Canada / Caribbean", min: 10, max: 10, re: /^\d{10}$/ },
  { id: "TO", code: "676", flag: "🇹🇴", zh: "汤加", en: "Tonga", min: 5, max: 7 }, // 2026-10-29 用户要求放常用里
  { id: "HK", code: "852", flag: "🇭🇰", zh: "中国香港", en: "Hong Kong", min: 8, max: 8 },
  { id: "MO", code: "853", flag: "🇲🇴", zh: "中国澳门", en: "Macau", min: 8, max: 8 },
  { id: "TW", code: "886", flag: "🇹🇼", zh: "中国台湾", en: "Taiwan", min: 9, max: 9 },
  { id: "SG", code: "65", flag: "🇸🇬", zh: "新加坡", en: "Singapore", min: 8, max: 8 },
  { id: "MY", code: "60", flag: "🇲🇾", zh: "马来西亚", en: "Malaysia", min: 9, max: 10 },
  { id: "GB", code: "44", flag: "🇬🇧", zh: "英国", en: "United Kingdom", min: 10, max: 10 },
  { id: "AU", code: "61", flag: "🇦🇺", zh: "澳大利亚", en: "Australia", min: 9, max: 9 },
  { id: "NZ", code: "64", flag: "🇳🇿", zh: "新西兰", en: "New Zealand", min: 8, max: 10 },
  { id: "JP", code: "81", flag: "🇯🇵", zh: "日本", en: "Japan", min: 10, max: 10 },
  { id: "KR", code: "82", flag: "🇰🇷", zh: "韩国", en: "South Korea", min: 9, max: 10 },
  { id: "TH", code: "66", flag: "🇹🇭", zh: "泰国", en: "Thailand", min: 9, max: 9 },
  { id: "VN", code: "84", flag: "🇻🇳", zh: "越南", en: "Vietnam", min: 9, max: 10 },
  { id: "PH", code: "63", flag: "🇵🇭", zh: "菲律宾", en: "Philippines", min: 10, max: 10 },
  { id: "ID", code: "62", flag: "🇮🇩", zh: "印度尼西亚", en: "Indonesia", min: 9, max: 12 },
  { id: "IN", code: "91", flag: "🇮🇳", zh: "印度", en: "India", min: 10, max: 10, re: /^[6-9]\d{9}$/ }, // 手机号 6–9 开头
  { id: "AE", code: "971", flag: "🇦🇪", zh: "阿联酋", en: "UAE", min: 9, max: 9 },
  { id: "DE", code: "49", flag: "🇩🇪", zh: "德国", en: "Germany", min: 10, max: 11 },
  { id: "FR", code: "33", flag: "🇫🇷", zh: "法国", en: "France", min: 9, max: 9 },
  { id: "IT", code: "39", flag: "🇮🇹", zh: "意大利", en: "Italy", min: 9, max: 10 },
  { id: "ES", code: "34", flag: "🇪🇸", zh: "西班牙", en: "Spain", min: 9, max: 9 },
  { id: "NL", code: "31", flag: "🇳🇱", zh: "荷兰", en: "Netherlands", min: 9, max: 9 },
  { id: "CH", code: "41", flag: "🇨🇭", zh: "瑞士", en: "Switzerland", min: 9, max: 9 },
  { id: "SE", code: "46", flag: "🇸🇪", zh: "瑞典", en: "Sweden", min: 9, max: 9 },
  { id: "IE", code: "353", flag: "🇮🇪", zh: "爱尔兰", en: "Ireland", min: 9, max: 9 },
  { id: "RU", code: "7", flag: "🇷🇺", zh: "俄罗斯", en: "Russia", min: 10, max: 10 },
  { id: "BR", code: "55", flag: "🇧🇷", zh: "巴西", en: "Brazil", min: 10, max: 11 },
  { id: "MX", code: "52", flag: "🇲🇽", zh: "墨西哥", en: "Mexico", min: 10, max: 10 },
  { id: "ZA", code: "27", flag: "🇿🇦", zh: "南非", en: "South Africa", min: 9, max: 9 },
];
/** 国旗:由 ISO 两位字母算出区域指示符(科索沃 XK 无官方旗帜,显示字母) */
const flagOf = (iso: string) => String.fromCodePoint(...[...iso].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
// 其余国家/地区(2026-10-29 用户查汤加 +676 → 一次补齐所有独立区号的国家,省得一个个加)。
// 格式:ISO|区号|中文|英文[|最少位|最多位];没写位数的按通用 4–14 位(纽埃等太平洋岛国号码只有 4–5 位)。
// 用 +1 的加勒比岛国并入「美国/加拿大」(+1 + 10 位,映射完全相同);+7 哈萨克斯坦与俄罗斯同区号。
const MORE = `FJ|679|斐济|Fiji
WS|685|萨摩亚|Samoa
PG|675|巴布亚新几内亚|Papua New Guinea
SB|677|所罗门群岛|Solomon Islands
VU|678|瓦努阿图|Vanuatu
KI|686|基里巴斯|Kiribati
TV|688|图瓦卢|Tuvalu
NR|674|瑙鲁|Nauru
PW|680|帕劳|Palau
FM|691|密克罗尼西亚|Micronesia
MH|692|马绍尔群岛|Marshall Islands
CK|682|库克群岛|Cook Islands
NU|683|纽埃|Niue
NC|687|新喀里多尼亚|New Caledonia
PF|689|法属波利尼西亚|French Polynesia
AF|93|阿富汗|Afghanistan
BD|880|孟加拉国|Bangladesh
BT|975|不丹|Bhutan
BN|673|文莱|Brunei
KH|855|柬埔寨|Cambodia
LA|856|老挝|Laos
MM|95|缅甸|Myanmar
MN|976|蒙古|Mongolia
NP|977|尼泊尔|Nepal
PK|92|巴基斯坦|Pakistan
LK|94|斯里兰卡|Sri Lanka
MV|960|马尔代夫|Maldives
TL|670|东帝汶|Timor-Leste
KP|850|朝鲜|North Korea
KZ|7|哈萨克斯坦|Kazakhstan
KG|996|吉尔吉斯斯坦|Kyrgyzstan
TJ|992|塔吉克斯坦|Tajikistan
TM|993|土库曼斯坦|Turkmenistan
UZ|998|乌兹别克斯坦|Uzbekistan
IR|98|伊朗|Iran
IQ|964|伊拉克|Iraq
IL|972|以色列|Israel
JO|962|约旦|Jordan
KW|965|科威特|Kuwait
LB|961|黎巴嫩|Lebanon
OM|968|阿曼|Oman
QA|974|卡塔尔|Qatar
SA|966|沙特阿拉伯|Saudi Arabia
SY|963|叙利亚|Syria
TR|90|土耳其|Türkiye
YE|967|也门|Yemen
BH|973|巴林|Bahrain
PS|970|巴勒斯坦|Palestine
AM|374|亚美尼亚|Armenia
AZ|994|阿塞拜疆|Azerbaijan
GE|995|格鲁吉亚|Georgia
CY|357|塞浦路斯|Cyprus
AL|355|阿尔巴尼亚|Albania
AD|376|安道尔|Andorra
AT|43|奥地利|Austria
BY|375|白俄罗斯|Belarus
BE|32|比利时|Belgium
BA|387|波黑|Bosnia and Herzegovina
BG|359|保加利亚|Bulgaria
HR|385|克罗地亚|Croatia
CZ|420|捷克|Czechia
DK|45|丹麦|Denmark
EE|372|爱沙尼亚|Estonia
FI|358|芬兰|Finland
GR|30|希腊|Greece
HU|36|匈牙利|Hungary
IS|354|冰岛|Iceland
LV|371|拉脱维亚|Latvia
LI|423|列支敦士登|Liechtenstein
LT|370|立陶宛|Lithuania
LU|352|卢森堡|Luxembourg
MT|356|马耳他|Malta
MD|373|摩尔多瓦|Moldova
MC|377|摩纳哥|Monaco
ME|382|黑山|Montenegro
MK|389|北马其顿|North Macedonia
NO|47|挪威|Norway
PL|48|波兰|Poland
PT|351|葡萄牙|Portugal
RO|40|罗马尼亚|Romania
SM|378|圣马力诺|San Marino
RS|381|塞尔维亚|Serbia
SK|421|斯洛伐克|Slovakia
SI|386|斯洛文尼亚|Slovenia
UA|380|乌克兰|Ukraine
XK|383|科索沃|Kosovo
AR|54|阿根廷|Argentina
BO|591|玻利维亚|Bolivia
CL|56|智利|Chile
CO|57|哥伦比亚|Colombia
EC|593|厄瓜多尔|Ecuador
GY|592|圭亚那|Guyana
PY|595|巴拉圭|Paraguay
PE|51|秘鲁|Peru
SR|597|苏里南|Suriname
UY|598|乌拉圭|Uruguay
VE|58|委内瑞拉|Venezuela
BZ|501|伯利兹|Belize
CR|506|哥斯达黎加|Costa Rica
SV|503|萨尔瓦多|El Salvador
GT|502|危地马拉|Guatemala
HN|504|洪都拉斯|Honduras
NI|505|尼加拉瓜|Nicaragua
PA|507|巴拿马|Panama
CU|53|古巴|Cuba
HT|509|海地|Haiti
DZ|213|阿尔及利亚|Algeria
AO|244|安哥拉|Angola
BJ|229|贝宁|Benin
BW|267|博茨瓦纳|Botswana
BF|226|布基纳法索|Burkina Faso
BI|257|布隆迪|Burundi
CM|237|喀麦隆|Cameroon
CV|238|佛得角|Cape Verde
CF|236|中非|Central African Republic
TD|235|乍得|Chad
KM|269|科摩罗|Comoros
CG|242|刚果(布)|Congo
CD|243|刚果(金)|DR Congo
CI|225|科特迪瓦|Côte d'Ivoire
DJ|253|吉布提|Djibouti
EG|20|埃及|Egypt
GQ|240|赤道几内亚|Equatorial Guinea
ER|291|厄立特里亚|Eritrea
SZ|268|斯威士兰|Eswatini
ET|251|埃塞俄比亚|Ethiopia
GA|241|加蓬|Gabon
GM|220|冈比亚|Gambia
GH|233|加纳|Ghana
GN|224|几内亚|Guinea
GW|245|几内亚比绍|Guinea-Bissau
KE|254|肯尼亚|Kenya
LS|266|莱索托|Lesotho
LR|231|利比里亚|Liberia
LY|218|利比亚|Libya
MG|261|马达加斯加|Madagascar
MW|265|马拉维|Malawi
ML|223|马里|Mali
MR|222|毛里塔尼亚|Mauritania
MU|230|毛里求斯|Mauritius
MA|212|摩洛哥|Morocco
MZ|258|莫桑比克|Mozambique
NA|264|纳米比亚|Namibia
NE|227|尼日尔|Niger
NG|234|尼日利亚|Nigeria
RW|250|卢旺达|Rwanda
ST|239|圣多美和普林西比|São Tomé and Príncipe
SN|221|塞内加尔|Senegal
SC|248|塞舌尔|Seychelles
SL|232|塞拉利昂|Sierra Leone
SO|252|索马里|Somalia
SS|211|南苏丹|South Sudan
SD|249|苏丹|Sudan
TZ|255|坦桑尼亚|Tanzania
TG|228|多哥|Togo
TN|216|突尼斯|Tunisia
UG|256|乌干达|Uganda
ZM|260|赞比亚|Zambia
ZW|263|津巴布韦|Zimbabwe`;
export const MORE_COUNTRIES: PhoneCountry[] = MORE.split("\n").map((line) => {
  const [id, code, zh, en, min, max] = line.split("|");
  return { id, code, flag: flagOf(id), zh, en, min: min ? Number(min) : 4, max: max ? Number(max) : 14 };
});
/** 下拉里「全部国家/地区」:按中文拼音 / 英文字母排序 */
export const sortedMore = (en: boolean) => [...MORE_COUNTRIES].sort((a, b) => (en ? a.en.localeCompare(b.en, "en") : a.zh.localeCompare(b.zh, "zh-Hans-CN")));
const ALL_COUNTRIES = [...PHONE_COUNTRIES, ...MORE_COUNTRIES];
export const countryById = (id: string) => ALL_COUNTRIES.find((c) => c.id === id);

/** 号码只留数字;非 +86/+1 去掉开头的长途前缀 0 */
export function nationalDigits(code: string, raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (code === "1") return /^1\d{10}$/.test(d) ? d.slice(1) : d; // 美加:带了国家码 1 的 11 位也认
  return code === "86" ? d : d.replace(/^0+/, "");
}

/** 校验:列表里的按位数;手动区号的放宽到 5–14 位。返回错误文案(null = 合法) */
export function phoneError(code: string, national: string, c?: PhoneCountry, en = false): string | null {
  if (!/^\d{1,4}$/.test(code)) return en ? "Enter a valid country code" : "请填写正确的区号";
  if (c?.re) return c.re.test(national) ? null : c.id === "CN" ? (en ? "Enter a valid 11-digit mobile number" : "请输入 11 位有效手机号") : (en ? "Enter a valid 10-digit number" : "请输入 10 位有效号码");
  const [min, max] = c ? [c.min, c.max] : [5, 14];
  if (national.length >= min && national.length <= max) return null;
  const n = min === max ? `${min}` : `${min}–${max}`;
  return en ? `Enter a ${n}-digit number` : `请输入 ${n} 位号码`;
}

export const phoneToEmail = (code: string, national: string) => `${code}${national}@${PHONE_DOMAIN}`;

/** 本机在印度(时区或系统语言):注册默认选 +91,登录时 10 位号码先按印度号码试(2026-11-11 用户「支持印度手机号」) */
export const IN_LOCALE: boolean = (() => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz === "Asia/Kolkata" || tz === "Asia/Calcutta" || (typeof navigator !== "undefined" && /-IN$/i.test(navigator.language));
  } catch { return false; }
})();

/** 登录框里没带区号的纯数字 → 可能的账号,按先后顺序逐个试(2026-11-11 印度、加拿大用户登不上:
 *  单看号码分不出国家,所以把所有说得通的解释都试一遍):
 *  - 11 位 1 开头:中国手机号;也可能是带了国家码 1 的美加号码(1 + 区号)
 *  - 10 位:美加号码;6–9 开头的也可能是印度手机号(本机在印度时先试印度)
 *  - 0 开头 11 位 / 91 开头 12 位:印度号码带了长途 0 或没写 + 的国家码
 *  空格、横线、括号、点都忽略(416-555-1234、(416) 555 1234 都认) */
export function bareLoginCandidates(raw: string): string[] {
  const d = raw.replace(/[\s\-().]/g, "");
  if (!/^\d+$/.test(d)) return [];
  const out: string[] = [];
  if (/^1[3-9]\d{9}$/.test(d)) out.push(phoneToEmail("86", d));
  if (/^1[2-9]\d{9}$/.test(d)) out.push(phoneToEmail("1", d.slice(1)));
  if (/^\d{10}$/.test(d) && !/^0/.test(d)) {
    const us = phoneToEmail("1", d), ind = phoneToEmail("91", d);
    out.push(...(/^[6-9]/.test(d) ? (IN_LOCALE ? [ind, us] : [us, ind]) : [us]));
  }
  if (/^0[6-9]\d{9}$/.test(d)) out.push(phoneToEmail("91", d.slice(1)));
  if (/^91[6-9]\d{9}$/.test(d)) out.push(phoneToEmail("91", d.slice(2)));
  // 马来西亚(线上已有 +60 用户):手机号 1 开头 9–10 位,常写成 01x…;也可能带了 60 没写 +
  if (/^1\d{8,9}$/.test(d)) out.push(phoneToEmail("60", d));
  if (/^01\d{8,9}$/.test(d)) out.push(phoneToEmail("60", d.slice(1)));
  if (/^601\d{8,9}$/.test(d)) out.push(phoneToEmail("60", d.slice(2)));
  return [...new Set(out)];
}

/** 登录框里的「+44 7911 123456 / 0044…」→ 内部邮箱;按已知区号最长匹配去掉长途 0,未知区号原样拼。不是 + / 00 开头返回 null */
export function intlPhoneToEmail(raw: string): string | null {
  const t = raw.trim();
  if (!/^(\+|00)/.test(t)) return null;
  const digits = t.replace(/^00/, "").replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 18) return null;
  const known = [...ALL_COUNTRIES].sort((a, b) => b.code.length - a.code.length).find((c) => digits.startsWith(c.code));
  if (known) return phoneToEmail(known.code, nationalDigits(known.code, digits.slice(known.code.length)));
  return `${digits}@${PHONE_DOMAIN}`;
}

/** 内部邮箱 → 给人看的账号(登录名 / 手机号;海外带 +区号) */
export function phoneLoginOf(local: string): string {
  if (local.startsWith("86") && local.length === 13) return local.slice(2);
  if (local.startsWith("1") && local.length === 11) return local.slice(1);
  const known = [...ALL_COUNTRIES].sort((a, b) => b.code.length - a.code.length).find((c) => local.startsWith(c.code));
  return known ? `+${known.code} ${local.slice(known.code.length)}` : `+${local}`;
}
