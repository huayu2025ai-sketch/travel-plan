# 首轮 SEO 实施与发布

正式站点：https://travel-plan.solalab.cn/

## 页面与构建

- `/`：静态产品首页，介绍规划、编辑和导出能力。
- `/templates/`：6 个公共模板的目录；每份模板有独立静态页面。
- `/guides/`：3 篇使用教程及目录。
- `/app/`：原 React 看板，沿用原 localStorage 键，旧行程继续可读。
- `/app/?template=hangzhou-2-days`：从模板启动；已有个人行程时须在页面明确选择替换。
- `/sitemap.xml`：仅列出 12 个公开页面；`/app/` 与不存在的页面不进入站点地图。
- `/robots.txt`：允许抓取公开页面及看板的 noindex，屏蔽 API 路径。

`npm run build` 先构建 Vite 看板，再生成静态站点。直接运行 `vite build` 不会完成静态站点构建。

`npm run check:site` 验证构建产物的 canonical、正文、内部链接、看板脚本与 SEO 资源；CI 同时运行测试、完整构建与此检查。

`npm run dev` 同时提供静态页面、看板和 API；`npm run preview` 预览构建，但不提供 AI API。

Docker Nginx 对不存在路径返回真实 404，不再将所有路径回退到首页。Vercel 使用现有静态产物目录与 API functions，无新增通配重写。独立 Nginx 部署也需使用 `try_files $uri $uri/ =404`，并配置 `error_page 404 /404.html`。

## 内容维护

公共模板由 `src/content/templates.js` 定义，静态页面与看板载入复用同一数据源。新增模板须有独立的路线说明、适合人群、每日安排、替代方案、预算范围说明及参考资料。不要批量复制只改地名。

费用默认待估算，日期和天气留空；页面说明停留时间为建议。资料链接用于景点背景与出行核对，不表示整条路线获得官方推荐或经过实地验证。更新内容时同时更新实际整理日期。

教程由 `src/content/guides.js` 定义；产品操作变化后应同步修改。静态 HTML 由 `site/render.js` 生成，样式在 `public/site.css`。域名在 `site/render.js`，看板埋点的正式域名限制在 `src/utils/analytics.js` 和 `index.html`；未来换域名时需要一并修改。

## 转化统计

沿用当前 Umami 网站 ID，仅正式域名记录线上流量。产品事件：

| 事件 | 触发条件 | 元数据 |
|---|---|---|
| `template_use` | 模板实际载入，不统计浏览和取消 | `template` 模板 slug |
| `generate_success` | 生成成功且数据被接收 | `mode` create / optimize |
| `plan_edit` | 提交一次看板或清单修改 | 无 |
| `export_success` | 文件保存完成，或浏览器下载已发起 | `format` json / markdown / png |

浏览器下载回退无法验证用户最终是否保留文件；取消原生保存对话框不计成功。埋点失败不影响使用；不发送行程内容、私人地点或 AI 输入。已有 Vercel Analytics 保持原配置。

每周按来源及落地页观察搜索访问、模板载入、编辑与导出趋势。自定义事件是操作次数，不能直接当作独立用户转化率；如需计算跨事件漏斗，应按分析后台实际支持的会话维度处理。

## 上线步骤

1. 执行 `npm test && npm run build && npm run check:site`。
2. 按当前生产部署方式发布；Docker 使用 `docker compose up -d --build`。
3. 检查首页、模板、`/app/`、站点地图和未知地址的 404；确认旧行程仍在。
4. 使用站点所有者账号验证 Google Search Console、Bing Webmaster Tools、百度搜索资源平台；按各平台实际可用入口提交站点地图或网址。
5. 正式站点进行一次模板使用与导出，确认 Umami 收到事件，再记录初始收录和流量基线。

搜索后台验证和收录提交需要对应账号权限，本轮代码修改不包含这些外部操作。收录与排名需等待搜索引擎处理，不由代码构建保证。
