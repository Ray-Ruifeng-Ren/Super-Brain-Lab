// CORS:App 壳(iOS capacitor://localhost / Android https://localhost)调线上函数要带这些头;网页同源不受影响。
// 文件名以 _ 开头,Netlify 不会把它当成独立函数部署。
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, apikey",
  "access-control-max-age": "86400",
};
export const withCors = (inner) => async (event, context) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  const res = await inner(event, context);
  return { ...res, headers: { ...CORS, ...(res.headers || {}) } };
};
