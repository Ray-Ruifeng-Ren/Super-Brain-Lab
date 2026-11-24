// 2026-10-29 手机号支持更多国家/地区:老 +86 / +1 账号映射必须完全不变;海外号码带区号登录、去长途 0
import { describe, it, expect } from "vitest";
import { PHONE_COUNTRIES, MORE_COUNTRIES, countryById, nationalDigits, phoneError, phoneToEmail, intlPhoneToEmail, phoneLoginOf } from "@/lib/phoneCountries";

describe("手机号国家/地区", () => {
  it("老账号映射不变:+86 11 位、+1 10 位", () => {
    expect(phoneToEmail("86", nationalDigits("86", "13800138000"))).toBe("8613800138000@phone.superbrainlab.org");
    expect(phoneToEmail("1", nationalDigits("1", "4155550100"))).toBe("14155550100@phone.superbrainlab.org");
    expect(intlPhoneToEmail("+86 138 0013 8000")).toBe("8613800138000@phone.superbrainlab.org");
    expect(intlPhoneToEmail("+1 (415) 555-0100")).toBe("14155550100@phone.superbrainlab.org");
  });
  it("海外:注册与登录得到同一个账号,长途 0 去掉", () => {
    const gb = countryById("GB")!;
    const reg = phoneToEmail(gb.code, nationalDigits(gb.code, "07911 123456"));
    expect(reg).toBe("447911123456@phone.superbrainlab.org");
    expect(intlPhoneToEmail("+44 7911 123456")).toBe(reg);
    expect(intlPhoneToEmail("+44 07911 123456")).toBe(reg);
    expect(intlPhoneToEmail("0044 7911 123456")).toBe(reg);
    const hk = countryById("HK")!;
    expect(intlPhoneToEmail("+852 6123 4567")).toBe(phoneToEmail(hk.code, "61234567"));
    expect(intlPhoneToEmail("13800138000")).toBeNull(); // 不带 + 的走原来的规则
  });
  it("校验位数", () => {
    expect(phoneError("86", "13800138000", countryById("CN"))).toBeNull();
    expect(phoneError("86", "1380013800", countryById("CN"))).not.toBeNull();
    expect(phoneError("44", "7911123456", countryById("GB"))).toBeNull();
    expect(phoneError("44", "791112345", countryById("GB"))).toBe("请输入 10 位号码");
    expect(phoneError("44", "791112345", countryById("GB"), true)).toBe("Enter a 10-digit number");
    expect(phoneError("", "12345678")).not.toBeNull();
    expect(phoneError("998", "901234567")).toBeNull(); // 手动区号:5–14 位
  });
  it("后台显示账号:中国/美加是号码,其他带 +区号", () => {
    expect(phoneLoginOf("8613800138000")).toBe("13800138000");
    expect(phoneLoginOf("14155550100")).toBe("4155550100");
    expect(phoneLoginOf("447911123456")).toBe("+44 7911123456");
    expect(phoneLoginOf("85261234567")).toBe("+852 61234567");
  });
  it("区号表不重复;汤加 +676 5–7 位", () => {
    const all = [...PHONE_COUNTRIES, ...MORE_COUNTRIES];
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    const to = countryById("TO")!;
    expect(to.code).toBe("676");
    expect(phoneError("676", "7712345", to)).toBeNull();
    expect(phoneError("676", "12345", to)).toBeNull();
    expect(phoneError("676", "1234", to)).not.toBeNull();
    expect(intlPhoneToEmail("+676 771 2345")).toBe("6767712345@phone.superbrainlab.org");
    expect(phoneLoginOf("6767712345")).toBe("+676 7712345");
    // 区号前缀互不冲突(ITU 区号是前缀码):埃及 20 vs 摩洛哥 212
    expect(intlPhoneToEmail("+212 612345678")).toBe("212612345678@phone.superbrainlab.org");
    expect(phoneLoginOf("212612345678")).toBe("+212 612345678");
  });
});

describe("印度手机号登录(2026-11-11)", () => {
  it("10 位 6–9 开头:印度和美加都试", async () => {
    const { bareLoginCandidates } = await import("@/lib/phoneCountries");
    const c = bareLoginCandidates("9876543210");
    expect(c).toContain("919876543210@phone.superbrainlab.org");
    expect(c).toContain("19876543210@phone.superbrainlab.org");
  });
  it("美加 2–5 开头只试 +1;中国 11 位先试 +86、再按带国家码的美加号码试", async () => {
    const { bareLoginCandidates } = await import("@/lib/phoneCountries");
    expect(bareLoginCandidates("4155550100")).toEqual(["14155550100@phone.superbrainlab.org"]);
    expect(bareLoginCandidates("13800138000")).toEqual(["8613800138000@phone.superbrainlab.org", "13800138000@phone.superbrainlab.org"]);
  });
  it("加拿大号码带国家码 1、带横线括号:都认成 +1", async () => {
    const { bareLoginCandidates, nationalDigits } = await import("@/lib/phoneCountries");
    expect(bareLoginCandidates("1 (416) 555-1234")).toContain("14165551234@phone.superbrainlab.org");
    expect(bareLoginCandidates("416-555-1234")).toEqual(["14165551234@phone.superbrainlab.org"]);
    expect(nationalDigits("1", "1 416 555 1234")).toBe("4165551234");
  });
  it("带 0 或带 91 没写 +:认成印度号码", async () => {
    const { bareLoginCandidates } = await import("@/lib/phoneCountries");
    expect(bareLoginCandidates("09876543210")).toEqual(["919876543210@phone.superbrainlab.org"]);
    expect(bareLoginCandidates("919876543210")).toEqual(["919876543210@phone.superbrainlab.org"]);
    expect(bareLoginCandidates("98765 43210")).toContain("919876543210@phone.superbrainlab.org");
  });
  it("注册校验:印度号码必须 6–9 开头 10 位", async () => {
    const { phoneError, countryById } = await import("@/lib/phoneCountries");
    expect(phoneError("91", "9876543210", countryById("IN"))).toBeNull();
    expect(phoneError("91", "1234567890", countryById("IN"))).not.toBeNull();
    expect(phoneError("91", "98765", countryById("IN"))).not.toBeNull();
  });
});

describe("马来西亚号码与默认语言(2026-11-12)", () => {
  it("马来西亚 01x 号码、带 60 的号码都认成 +60", async () => {
    const { bareLoginCandidates } = await import("@/lib/phoneCountries");
    expect(bareLoginCandidates("0164564611")).toContain("60164564611@phone.superbrainlab.org");
    expect(bareLoginCandidates("60164564611")).toContain("60164564611@phone.superbrainlab.org");
    expect(bareLoginCandidates("164564611")).toContain("60164564611@phone.superbrainlab.org");
  });
  it("默认语言:中文浏览器中文,其他英文;手动选过以手动为准", async () => {
    const { detectLang } = await import("@/lib/langState");
    const nav = navigator as unknown as { language: string; languages: string[] };
    const set = (l: string, more: string[] = []) => { Object.defineProperty(nav, "language", { value: l, configurable: true }); Object.defineProperty(nav, "languages", { value: [l, ...more], configurable: true }); };
    localStorage.removeItem("lang");
    set("en-IN"); expect(detectLang()).toBe("en");
    set("en-US", ["zh-Hans-CN"]); expect(detectLang()).toBe("en"); // 列表里排后面的中文不算
    set("zh-CN"); expect(detectLang()).toBe("zh");
    set("en-US"); localStorage.setItem("lang", "zh"); expect(detectLang()).toBe("zh");
    localStorage.removeItem("lang");
  });
});
