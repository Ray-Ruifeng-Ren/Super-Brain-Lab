// 等级鉴定电子证书 —— 铜金蕾丝框版(v4.3 定稿;2026-09-19 深夜相框实拍版 v5 被用户评"浮夸"回滚至此):
// 淡金中心+深铜边缘晕影 + 深金扁平刻字 + 繁花蕾丝金框(镂空角花) + 官方铜章(金绶带) + 裸二维码。
// 全 SVG 渐变、无 filter,序列化 → canvas 导出 PNG 稳定。
import { useRef, useState, type ReactNode } from "react";
import { X, Download } from "lucide-react";
import qrcode from "qrcode-generator";
import { MEDAL_DATA_URI } from "@/assets/medalDataUri";
import { levelById, levelSpec, levelName, fmtMs, certNo, CERT_PASS, CERT_PROBLEMS } from "@/lib/cert";
import { useI18n } from "@/lib/i18n";

// 分享回流二维码:普通短链,扫码直进网站首页。模块预生成为 SVG path。
const QR_TARGET = "https://superbrainlab.org";
const QR = (() => {
  const q = qrcode(0, "M");
  q.addData(QR_TARGET);
  q.make();
  const n = q.getModuleCount();
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return { d, n };
})();

interface Props {
  nickname: string;
  levelId: string;     // k20…k1 / d1…d20
  ms: number;          // 最快作答总用时
  dateISO: string;     // 首次通过日期
  userId: string;
  onClose: () => void;
}

// 铜牌材质色板
const BODY = "#33230A";       // 正文深铜墨(淡色中心上高对比)
const FAINT = "#5E4517";      // 辅助深铜
const EDGE = "#F0D48A";       // 亮金饰线
const EDGE_D = "#3A2506";     // 暗刻槽线
const SERIF = `"Songti SC","Noto Serif SC","STSong","Georgia","Times New Roman",serif`;
const EN_SERIF = `"Georgia","Times New Roman",serif`;
const SCRIPT = `"Snell Roundhand","Apple Chancery","Segoe Script",cursive`;

/** 深金渐变扁平刻字(用户定:不要阴影)。children 内 tspan 勿带 fill。 */
function Emboss({ x, y, size, ls = 0, family = SERIF, weight = 700, children }: {
  x: number; y: number; size: number; ls?: number | string; family?: string; weight?: number | string; children: ReactNode;
}) {
  return <text x={x} y={y} textAnchor="middle" fontFamily={family} fontSize={size} fontWeight={weight} letterSpacing={ls} fill="url(#dp-goldtext)">{children}</text>;
}

export function CertDiploma({ nickname, levelId, ms, dateISO, userId, onClose }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [saving, setSaving] = useState(false);
  // 英文版证书(2026-10-27 切换英文时整页英文):颁文、日期、落款、按钮跟随语言
  const { lang } = useI18n();
  const en = lang === "en";
  const lv = levelById(levelId)!;
  const name = levelName(lv, en);
  const d = new Date(dateISO);
  const dateCN = en
    ? d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  const no = certNo(levelId, dateISO, userId);

  const download = async () => {
    const svg = svgRef.current;
    if (!svg || saving) return;
    setSaving(true);
    try {
      const xml = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("svg load")); img.src = url; });
      const canvas = document.createElement("canvas");
      canvas.width = 2000; canvas.height = 1400; // 2x 导出,分享清晰
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, 2000, 1400);
      URL.revokeObjectURL(url);
      const png = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (png) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(png);
        a.download = en ? `Flash-Anzan-${name.replace(" ", "-")}-Certificate-${nickname}.png` : `闪电心算${lv.label}证书-${nickname}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
    } catch { /* 极老浏览器序列化失败:忽略,证书仍可截图 */ }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <svg ref={svgRef} viewBox="0 0 1000 700" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", display: "block", borderRadius: 4, boxShadow: "0 30px 80px rgba(0,0,0,.65)" }}>
          <defs>
            {/* 铜板:淡金中心 → 深铜边缘(强晕影) */}
            <radialGradient id="dp-bronze" cx="0.5" cy="0.42" r="0.95">
              <stop offset="0" stopColor="#F2E3BE" /><stop offset="0.5" stopColor="#DDC189" /><stop offset="0.82" stopColor="#9A7434" /><stop offset="1" stopColor="#57400F" />
            </radialGradient>
            {/* 拉丝纹 */}
            <pattern id="dp-brush" width="4" height="3" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0.5" x2="4" y2="0.5" stroke="#FFF1C4" strokeWidth="0.35" opacity="0.05" />
              <line x1="0" y1="2" x2="4" y2="2" stroke="#241503" strokeWidth="0.4" opacity="0.07" />
            </pattern>
            {/* 深金刻字渐变 */}
            <linearGradient id="dp-goldtext" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#C79A45" /><stop offset="0.55" stopColor="#A0762A" /><stop offset="1" stopColor="#78551A" />
            </linearGradient>
            {/* 金绶带 */}
            <linearGradient id="dp-ribbon" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#E2C374" /><stop offset="1" stopColor="#A87E33" />
            </linearGradient>
            {/* 繁花蕾丝饰带 */}
            <pattern id="dp-band" width="26" height="20" patternUnits="userSpaceOnUse">
              <path d="M0,10 Q6.5,2 13,10 T26,10" fill="none" stroke="#A8792B" strokeWidth="1.6" />
              <path d="M0,10 Q6.5,18 13,10 T26,10" fill="none" stroke="#A8792B" strokeWidth="1.6" opacity="0.85" />
              <circle cx="13" cy="10" r="2.4" fill="#C79A45" />
              <circle cx="13" cy="10" r="1" fill="#F0D48A" />
              <circle cx="0" cy="10" r="1.4" fill="#8A6420" /><circle cx="26" cy="10" r="1.4" fill="#8A6420" />
              <circle cx="6.5" cy="3.5" r="1" fill="#C79A45" /><circle cx="19.5" cy="3.5" r="1" fill="#C79A45" />
              <circle cx="6.5" cy="16.5" r="1" fill="#C79A45" /><circle cx="19.5" cy="16.5" r="1" fill="#C79A45" />
            </pattern>
            <clipPath id="dp-medal-clip"><circle r="61" /></clipPath>
          </defs>

          {/* 铜板 + 拉丝 */}
          <rect width="1000" height="700" fill="url(#dp-bronze)" />
          <rect width="1000" height="700" fill="url(#dp-brush)" />

          {/* 金色繁花边框:细双外线 → 蕾丝饰带 → 细双内线 → 四角镂空金线角花 */}
          <rect x="22" y="22" width="956" height="656" fill="none" stroke="#8A6420" strokeWidth="2.2" />
          <rect x="26" y="26" width="948" height="648" fill="none" stroke="#E8CD8C" strokeWidth="0.8" />
          <rect x="31" y="31" width="938" height="20" fill="url(#dp-band)" />
          <rect x="31" y="649" width="938" height="20" fill="url(#dp-band)" />
          <rect x="31" y="31" width="20" height="638" fill="url(#dp-band)" />
          <rect x="949" y="31" width="20" height="638" fill="url(#dp-band)" />
          <rect x="56" y="56" width="888" height="588" fill="none" stroke="#A8792B" strokeWidth="1.2" />
          <rect x="59" y="59" width="882" height="582" fill="none" stroke="#E8CD8C" strokeWidth="0.6" opacity="0.9" />

          {/* 顶部金闪电徽饰 */}
          <g transform="translate(500 82)">
            <path d="M 2.5,-16 L -7,1 L -1.5,1 L -3,14 L 7.5,-4 L 1.5,-4 Z" fill="url(#dp-goldtext)" />
            <line x1="-58" y1="0" x2="-20" y2="0" stroke={EDGE} strokeWidth="0.9" opacity="0.6" />
            <line x1="20" y1="0" x2="58" y2="0" stroke={EDGE} strokeWidth="0.9" opacity="0.6" />
          </g>

          {/* 页眉:深金刻字 */}
          <Emboss x={500} y={128} size={27} ls={11} family={EN_SERIF} weight={600}>ZHUXIANG · 珠象</Emboss>
          <Emboss x={500} y={152} size={12.5} ls={en ? 6 : 9} weight={600} family={en ? EN_SERIF : SERIF}>{en ? "BRAIN ARENA" : "脑 力 竞 技 场"}</Emboss>

          <text x="500" y="186" textAnchor="middle" fill={FAINT} fontFamily={EN_SERIF} fontSize="12" fontStyle="italic" letterSpacing="1">To all to whom these presents may come, Greeting :</text>

          {/* 兹证明 + 姓名 */}
          <Emboss x={500} y={226} size={15.5} ls={en ? 2 : 8} weight={600} family={en ? EN_SERIF : SERIF}>{en ? "This is to certify that" : "兹 证 明"}</Emboss>
          <Emboss x={500} y={280} size={45} ls={5}>{nickname}</Emboss>
          <g transform="translate(500 299)">
            <line x1="-160" y1="1" x2="160" y2="1" stroke={EDGE_D} strokeWidth="1" opacity="0.8" />
            <line x1="-160" y1="0" x2="160" y2="0" stroke={EDGE} strokeWidth="0.8" />
            <rect x="-3" y="-3" width="6" height="6" transform="rotate(45)" fill={EDGE} />
          </g>

          {/* 颁文 */}
          {en ? (<>
            <text x="500" y="338" textAnchor="middle" fill={BODY} fontFamily={EN_SERIF} fontSize="16.5">has passed the Flash Anzan Certification</text>
            <Emboss x={500} y={380} size={21} family={EN_SERIF}>
              and is hereby awarded<tspan fontSize="28" dx="8" dy="1"> {name} </tspan>
            </Emboss>
            <text x="500" y="412" textAnchor="middle" fill={FAINT} fontFamily={EN_SERIF} fontSize="12" letterSpacing="0.5">
              {name} standard — {levelSpec(lv, true)} · addition only · {CERT_PASS}+ of {CERT_PROBLEMS} correct · fastest {fmtMs(ms)}
            </text>
            <text x="500" y="443" textAnchor="middle" fill={BODY} fontFamily={EN_SERIF} fontSize="14" letterSpacing="1">Awarded on {dateCN}</text>
          </>) : (<>
            <text x="500" y="338" textAnchor="middle" fill={BODY} fontFamily={SERIF} fontSize="16.5">于「闪电心算等级鉴定」中成绩合格</text>
            <Emboss x={500} y={380} size={21}>
              特授予<tspan fontSize="28" dx="8" dy="1"> {lv.label} </tspan><tspan dx="8" dy="-1">,颁此证为凭</tspan>
            </Emboss>
            <text x="500" y="412" textAnchor="middle" fill={FAINT} fontFamily={SERIF} fontSize="12.5" letterSpacing="1.5">
              {lv.label}标准 —— {levelSpec(lv)} · 纯加法 · {CERT_PROBLEMS} 题答对 {CERT_PASS} 题以上 · 最快作答 {fmtMs(ms)}
            </text>
            <text x="500" y="443" textAnchor="middle" fill={BODY} fontFamily={SERIF} fontSize="14" letterSpacing="2">颁发于 {dateCN}</text>
          </>)}

          {/* 官方铜章 + 环抱式金绶带(2026-11-02 用户:证书只改落款,徽章仍用原铜章) */}
          <g transform="translate(500 542)">
            <ellipse cx="0" cy="76" rx="60" ry="7" fill="#1A0F02" opacity="0.35" />
            <path d="M -99,25 L -89,17.5 L -86,9 L -57.1,26.6 A 63,63 0 0 1 -71.6,33.4 Z" fill="url(#dp-ribbon)" stroke="#7C5D1F" strokeWidth="0.8" opacity="0.96" />
            <path d="M 99,25 L 89,17.5 L 86,9 L 57.1,26.6 A 63,63 0 0 0 71.6,33.4 Z" fill="url(#dp-ribbon)" stroke="#7C5D1F" strokeWidth="0.8" opacity="0.96" />
            <path d="M -71.6,33.4 A 79,79 0 0 0 71.6,33.4 L 57.1,26.6 A 63,63 0 0 1 -57.1,26.6 Z" fill="url(#dp-ribbon)" stroke="#7C5D1F" strokeWidth="0.9" />
            <path d="M -68.9,32.1 A 76,76 0 0 0 68.9,32.1" fill="none" stroke="#F3CC85" strokeWidth="1.2" opacity="0.7" />
            <path d="M -59.8,27.9 A 66,66 0 0 0 59.8,27.9" fill="none" stroke="#F3CC85" strokeWidth="0.9" opacity="0.5" />
            <image href={MEDAL_DATA_URI} x="-62" y="-62" width="124" height="124" clipPath="url(#dp-medal-clip)" preserveAspectRatio="xMidYMid slice" />
            <circle r="61" fill="none" stroke={EDGE_D} strokeWidth="1.6" opacity="0.9" />
            <circle r="62.2" fill="none" stroke={EDGE} strokeWidth="0.8" opacity="0.7" />
          </g>

          {/* 左:日期栏 右:签名栏 */}
          <g textAnchor="middle">
            <text x="185" y="560" fill={BODY} fontFamily={SCRIPT} fontSize="21" fontStyle="italic">{dateCN}</text>
            <line x1="95" y1="575" x2="275" y2="575" stroke={EDGE_D} strokeWidth="1" opacity="0.8" />
            <line x1="95" y1="574" x2="275" y2="574" stroke={EDGE} strokeWidth="0.7" opacity="0.9" />
            {!en && <text x="185" y="592" fill={BODY} fontFamily={SERIF} fontSize="11.5" letterSpacing="2">颁 发 日 期</text>}
            <text x="185" y="608" fill={FAINT} fontFamily={EN_SERIF} fontSize="8.5" letterSpacing="2.5">DATE OF AWARD</text>

            <text x="748" y="560" fill={BODY} fontFamily={SCRIPT} fontSize="23" fontStyle="italic">Zhuxiang 珠象</text>
            <line x1="660" y1="575" x2="836" y2="575" stroke={EDGE_D} strokeWidth="1" opacity="0.8" />
            <line x1="660" y1="574" x2="836" y2="574" stroke={EDGE} strokeWidth="0.7" opacity="0.9" />
            {!en && <text x="748" y="592" fill={BODY} fontFamily={SERIF} fontSize="11.5" letterSpacing="2">等 级 鉴 定 委 员 会</text>}
            <text x="748" y="608" fill={FAINT} fontFamily={EN_SERIF} fontSize="8.5" letterSpacing="2.5">BOARD OF EXAMINERS</text>
          </g>

          {/* 右下:裸二维码 */}
          <g transform="translate(852 550)">
            <g transform={`scale(${60 / QR.n})`}>
              <path d={QR.d} fill="#2B1A05" />
            </g>
            <text x="30" y="72" textAnchor="middle" fill="#5C4322" fontFamily={SERIF} fontSize="7.5" letterSpacing="1.5">{en ? "SCAN TO PLAY" : "扫码来挑战"}</text>
            <text x="30" y="81" textAnchor="middle" fill="#7A5E2F" fontFamily={EN_SERIF} fontSize="5.8" letterSpacing="0.8">SUPERBRAINLAB.ORG</text>
          </g>

          {/* 底缘编号 */}
          <text x="68" y="634" fill={FAINT} fontFamily="ui-monospace,monospace" fontSize="9.5" letterSpacing="1">CERT NO. {no}</text>
          <text x="500" y="636" textAnchor="middle" fill={FAINT} fontFamily={EN_SERIF} fontSize="8.5" letterSpacing="2" opacity="0.95">SUPERBRAINLAB.ORG · {en ? "ISSUED BY THE ZHUXIANG CERTIFICATION SYSTEM" : "本证书由珠象等级鉴定系统签发"}</text>
        </svg>

        <div className="mt-3 flex items-center justify-center gap-2">
          <button onClick={download} disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-6 py-2.5 text-sm font-black text-black transition-transform hover:scale-[1.02]">
            <Download className="h-4 w-4" /> {saving ? (en ? "Preparing…" : "生成中…") : (en ? "Download certificate" : "下载证书图片")}
          </button>
          <button onClick={onClose} className="inline-flex items-center gap-1 rounded-full border border-white/30 px-5 py-2.5 text-sm font-bold text-white/90 hover:bg-white/10">
            <X className="h-4 w-4" /> {en ? "Close" : "关闭"}
          </button>
        </div>
      </div>
    </div>
  );
}
