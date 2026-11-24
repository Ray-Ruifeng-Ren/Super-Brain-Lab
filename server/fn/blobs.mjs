// 自建服务器上替代 @netlify/blobs:同样的 getStore 接口,数据存在本地磁盘(BLOBS_DIR/<store 名>/)。
// 只有一个 Node 进程读写,写入用「临时文件 + rename」保证原子性,天然就是强一致。
// 每个 store 在内存里维护一份 key 索引,list 不用每次扫目录(比赛大屏每秒都在 list 报名名单)。
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.BLOBS_DIR || path.resolve("blobs-data");
const stores = new Map();

// key 里有「/」(如 c/<比赛>/reg/<手机号>),整体编码成一个文件名,避免 c/x 和 c/x/meta 目录冲突
const fileOf = (dir, key) => path.join(dir, encodeURIComponent(key));

function toBuffer(data) {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === "string") return Buffer.from(data, "utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  throw new TypeError("blobs: 不支持的数据类型");
}

function open(name) {
  const dir = path.join(ROOT, name);
  fs.mkdirSync(dir, { recursive: true });
  const keys = new Set(fs.readdirSync(dir).filter((f) => !f.startsWith(".tmp-")).map((f) => decodeURIComponent(f)));

  const write = async (key, data) => {
    const buf = data instanceof Blob ? Buffer.from(await data.arrayBuffer()) : toBuffer(data);
    const tmp = path.join(dir, `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.promises.writeFile(tmp, buf);
    await fs.promises.rename(tmp, fileOf(dir, key));
    keys.add(key);
  };

  return {
    async get(key, opts = {}) {
      let buf;
      try { buf = await fs.promises.readFile(fileOf(dir, key)); } catch { return null; }
      const type = typeof opts === "string" ? opts : opts.type;
      if (type === "json") return JSON.parse(buf.toString("utf8"));
      if (type === "arrayBuffer") return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      if (type === "blob") return new Blob([buf]);
      if (type === "stream") return fs.createReadStream(fileOf(dir, key));
      return buf.toString("utf8");
    },
    set: (key, data) => write(key, data),
    setJSON: (key, value) => write(key, JSON.stringify(value)),
    async delete(key) {
      try { await fs.promises.unlink(fileOf(dir, key)); } catch { /* 本来就没有 */ }
      keys.delete(key);
    },
    async list(opts = {}) {
      const prefix = opts.prefix || "";
      const blobs = [];
      for (const key of keys) if (key.startsWith(prefix)) blobs.push({ key, etag: "" });
      blobs.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      return { blobs, directories: [] };
    },
  };
}

export function getStore(nameOrOpts) {
  const name = typeof nameOrOpts === "string" ? nameOrOpts : nameOrOpts?.name;
  if (!name || /[\\/]|\.\./.test(name)) throw new Error("blobs: store 名不合法");
  if (!stores.has(name)) stores.set(name, open(name));
  return stores.get(name);
}
