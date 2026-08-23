// data/projects.data.js — the 20 demo projects.
//
// Row format (pipe-delimited):
//   Name|slug|org|Language|stars|description|direct-deps
// direct-deps item:  packageName@versionSpec[@resolvedVersion]
//   • versionSpec     what package.json declares (display value)
//   • resolvedVersion optional lockfile resolution — when present, queries
//     follow THIS exact Version node instead of the package latest
//
// Scenario wiring:
//   ShopStack   → next → webpack → package-x → lodash@4.17.21 (S3 deep)
//                 + recharts@2.12.2 → lodash@4.17.21 (second route, S5-like)
//   AdminPortal → webpack → lodash (S2 transitive) AND direct lodash (S1)
//   CloudPilot  → next deep chain; pins PATCHED lodash 4.17.23 (safe story)
//   DataForge   → package-a → lodash AND package-b → package-c → lodash (S5)
//   InsightCRM  → direct vulnerable lodash@4.17.21 + vulnerable ejs pin (S1)
//   FinTrack    → pinned vulnerable axios@0.21.1 and jsonwebtoken@8.5.1
//   ChatWave / PixelCanvas → deliberately vulnerability-free (empty states)

export const PROJECT_ROWS = [
  "ShopStack|shopstack|demo|TypeScript|2847|Headless commerce storefront with realtime inventory|next@^14.2.5@14.2.5,react@^18.3.1@18.3.1,react-dom@^18.3.1@18.3.1,zustand@^4.5.2@4.5.2,@tanstack/react-query@^5.28.0@5.28.0,zod@^3.23.0@3.23.0,axios@^1.6.2@1.6.2,tailwindcss@^3.4.3@3.4.3,recharts@^2.12.2@2.12.2,lucide-react@^0.363.0@0.363.0,typescript@^5.4.5@5.4.5,eslint@^8.57.0@8.57.0",
  "AdminPortal|admin-portal|acme-cloud|TypeScript|1204|Internal admin console with role-based access control|react@^18.3.1@18.3.1,react-dom@^18.3.1@18.3.1,webpack@^5.91.0@5.91.0,lodash@^4.17.21@4.17.21,axios@^1.6.2@1.6.2,tailwindcss@^3.4.3@3.4.3,recharts@^2.12.2@2.12.2,zod@^3.23.0@3.23.0,typescript@^5.4.5@5.4.5,styled-components@^6.1.8@6.1.8",
  "CloudPilot|cloudpilot|nova-labs|TypeScript|987|Multi-cloud deployment orchestrator with drift detection|next@^14.2.5@14.2.5,express@^4.19.2@4.19.2,@aws-sdk/client-s3@^3.540.0@3.540.0,dotenv@^16.4.5@16.4.5,zod@^3.23.0@3.23.0,jsonwebtoken@^9.0.0@9.0.0,lodash@^4.17.23@4.17.23,pino@^8.20.0@8.20.0,typescript@^5.4.5@5.4.5",
  "DataForge|dataforge|quantify-io|JavaScript|654|ETL pipelines for analytics teams|package-a@^1.0.0@1.0.0,package-b@^1.2.0@1.2.0,express@^4.18.2@4.18.2,mongoose@^8.2.3@8.2.3,dotenv@^16.4.5@16.4.5,uuid@^9.0.1@9.0.1",
  "FinTrack|fintrack|brightside|TypeScript|432|Personal finance tracking with bank synchronization|axios@^0.21.1@0.21.1,express@^4.18.2@4.18.2,zod@^3.23.0@3.23.0,jsonwebtoken@^8.5.1@8.5.1,moment@^2.29.1@2.29.1,winston@^3.13.0@3.13.0",
  "InsightCRM|insight-crm|pixelworks|JavaScript|318|Lightweight CRM for sales teams|lodash@^4.17.21@4.17.21,express@^4.18.2@4.18.2,ejs@^3.1.5@3.1.5,marked@^1.1.0@1.1.0,dotenv@^16.4.5@16.4.5",
  "MediaHub|mediahub|hexagon-digital|TypeScript|777|Media transcoding and streaming portal|next@^14.1.0@14.2.5,webpack@^5.88.2@5.88.2,three@^0.163.0@0.163.0,framer-motion@^11.0.8@11.0.8,tailwindcss@^3.4.3@3.4.3",
  "DevMetrics|devmetrics|lumen-analytics|JavaScript|256|Engineering analytics dashboards|express@^4.19.2@4.19.2,recharts@^2.12.2@2.12.2,lodash@^4.17.21@4.17.21,redis@^4.6.13@4.6.13,dotenv@^16.4.5@16.4.5",
  "TaskFlow|taskflow|orbit-tools|TypeScript|512|Kanban project tracker with offline sync|next@^14.2.5@14.2.5,react@^18.3.1@18.3.1,@prisma/client@^5.11.0@5.11.0,zod@^3.23.0@3.23.0,tailwindcss@^3.4.3@3.4.3",
  "GeoSense|geosense|atlas-systems|JavaScript|189|Geospatial analytics API platform|express@^4.18.2@4.18.2,d3@^7.9.0@7.9.0,graphql@^16.8.1@16.8.1,@apollo/server@^4.9.5@4.9.5",
  "ChatWave|chatwave|pulsar-collective|TypeScript|934|Realtime chat with end-to-end encryption|socket.io@^4.7.5@4.7.5,react@^18.3.1@18.3.1,react-dom@^18.3.1@18.3.1,vite@^5.4.0@5.4.0,zustand@^4.5.2@4.5.2",
  "DocsForge|docsforge|redwood-institute|JavaScript|143|Documentation site generator|next@^14.2.5@14.2.5,markdown-it@^10.0.0@10.0.0,marked@^12.0.2@12.0.2,prismjs@^1.23.0@1.23.0,tailwindcss@^3.4.3@3.4.3",
  "ApiGateway|apigateway|summitware|TypeScript|689|Edge API gateway with rate limiting|express@^4.19.2@4.19.2,helmet@^7.1.0@7.1.0,pino@^8.20.0@8.20.0,redis@^4.6.13@4.6.13,dotenv@^16.4.5@16.4.5,zod@^3.23.0@3.23.0",
  "PixelCanvas|pixelcanvas|verdant-ui|JavaScript|97|Collaborative browser pixel-art canvas|three@^0.166.1@0.166.1,vite@^5.2.0@5.2.0,postcss@^8.4.38@8.4.38,autoprefixer@^10.4.19@10.4.19",
  "NotifyHub|notifyhub|cinderstack|JavaScript|208|Multi-channel notification dispatcher|nodemailer@^6.9.13@6.9.13,node-notifier@^8.0.0@8.0.0,express@^4.19.2@4.19.2,ejs@^3.1.10@3.1.10,dotenv@^16.4.5@16.4.5",
  "AuthLab|authlab|cobalt-labs|TypeScript|377|Authentication lab and token playground|jsonwebtoken@^9.0.0@9.0.0,bcryptjs@^2.4.3@2.4.3,passport@^0.7.0@0.7.0,express@^4.19.2@4.19.2,uuid@^9.0.1@9.0.1,got@^11.8.2@11.8.2",
  "LogLense|loglense|stackforge|JavaScript|165|Structured log ingestion and search|pino@^8.20.0@8.20.0,winston@^3.13.0@3.13.0,morgan@^1.10.0@1.10.0,express@^4.18.2@4.18.2,debug@^4.3.4@4.3.4,tar@^6.1.8@6.1.8",
  "ShopMobile|shopmobile|harborline|TypeScript|298|Mobile companion storefront|react@^18.2.0@18.2.0,axios@^0.21.1@0.21.1,zustand@^4.5.2@4.5.2,vite@^5.4.0@5.4.0,tailwindcss@^3.4.3@3.4.3",
  "WikiEngine|wikiengine|northwind-dev|JavaScript|121|Markdown-first wiki engine|express@^4.18.2@4.18.2,marked@^1.1.0@1.1.0,prismjs@^1.29.0@1.29.0,mongoose@^8.2.3@8.2.3,dotenv@^16.4.5@16.4.5",
  "GridStudio|gridstudio|forge-oss|TypeScript|455|Spreadsheet-powered data exploration studio|react@^18.3.1@18.3.1,react-dom@^18.3.1@18.3.1,recharts@^2.12.7@2.12.7,lodash@^4.17.23@4.17.23,vite@^5.2.0@5.2.0,typescript@^5.3.3@5.3.3",
];

/** The flagship demo project used by the landing page CTA. */
export const DEMO_PROJECT_SLUG = "shopstack";
