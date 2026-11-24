# 网站本体(http / https 两个 server 共用)
root /srv/www;
index index.html;
client_max_body_size 15m;           # 比赛报名照片、语音作答录音
gzip on;
gzip_types text/css application/javascript application/json image/svg+xml text/plain;
gzip_min_length 1024;

proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

# —— 接口 ——
# 后台 admin-data(supabase.functions.invoke)→ 云函数运行器
location /sb-api/functions/v1/ { proxy_pass http://fn:8787/functions/v1/; }
# 登录、数据:只放行这两类,Supabase 管理台(Studio)不对外,要用时走 SSH 隧道
location /sb-api/auth/v1/ { proxy_pass http://kong:8000/auth/v1/; }
location /sb-api/rest/v1/ { proxy_pass http://kong:8000/rest/v1/; }
location /sb-api/ { return 404; }
# 云函数:比赛、报题语音、注销账号、重置密码、准考证、语音作答识别
location /.netlify/functions/ { proxy_pass http://fn:8787; proxy_read_timeout 90s; }

# —— 静态资源(对应 public/_headers)——
location ~ ^/tts-bank6/ { add_header Access-Control-Allow-Origin * always; add_header Cache-Control "public, max-age=604800" always; try_files $uri =404; }
location ~ ^/(tts-bank[0-9]*|tts-audition)/ { add_header Access-Control-Allow-Origin * always; try_files $uri =404; }
location /fonts/ { add_header Access-Control-Allow-Origin * always; add_header Cache-Control "public, max-age=31536000, immutable" always; try_files $uri =404; }
location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable" always; try_files $uri =404; }
location = /index.html { add_header Cache-Control "no-cache" always; }
location /download/ { try_files $uri $uri/index.html =404; }

# —— 单页应用路由兜底(对应 _redirects 的 /* /index.html 200)——
location / { try_files $uri $uri/ /index.html; }
