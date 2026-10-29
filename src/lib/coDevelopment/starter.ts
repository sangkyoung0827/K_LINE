import { labOnboarding } from "./onboarding";
import { labActionSchema } from "./schema";

// Download contains source and connection instructions only, never credentials.
export function labStarter(origin: string): Record<string, string> {
  return {
    "START-HERE.md": labOnboarding(origin),
    "openapi.json": JSON.stringify(labActionSchema(origin),null,2),
    "package.json": JSON.stringify({ name: "kline-developer-project", version: "1.0.0", private: true, type: "module", scripts: { build: "node tools/build.mjs", sync: "node --env-file=.env.local tools/sync.mjs" }, devDependencies: { esbuild: "0.28.2", "@modelcontextprotocol/sdk": "1.32.1", zod: "4.6.7" } }, null, 2),
    ".gitignore": "node_modules/\ndist/\n.env*\n.lab-project.json\n",
    "AGENTS.md": `# Private K_LINE development\nWork freely on this project's source and tests. Use synthetic data only. This is NOT the K_LINE production repository.\nBuild locally; use the kline_lab MCP tools to save a versioned bundle and customize its private card.\nUse window.KLINE_LAB.records for the shared test backend. Do not fetch production APIs, use SQL, put credentials in source, push the owner's repository, publish, or deploy.\nNative form submissions are blocked in the sandbox. Use type=button click/keydown handlers and the SDK for all saves.\nBackend source may be developed and tested locally, but uploading source does not execute it on K_LINE. Additional server runtimes and integrations require a separately reviewed isolated preview.\nRead current versions before saving. Preserve ids on retries. Do not override remote changes silently. Do not read .env.local into a model message or tool output.\n`,
    "README.md": `# K_LINE Developer Studio\n\nOpen this folder in your own Codex. Node.js 20.19+ required. Run npm install --ignore-scripts, then npm run build.\n\n## Connect Codex\nAdd the following to a trusted project's .codex/config.toml (or configure it in Codex MCP settings):\n\n[mcp_servers.kline_lab]\nurl = "${origin}/api/co-development/mcp"\nbearer_token_env_var = "KLINE_LAB_TOKEN"\n\nSet KLINE_LAB_TOKEN in the environment that launches Codex; never put its value in source or prompts. Restart Codex and verify its MCP tools. This is the lab-issued key, NOT an OpenAI API key.\n\nGet the key after Google login in the private lab. For CLI sync only, create a local ignored .env.local containing KLINE_LAB_URL=${origin} and KLINE_LAB_TOKEN=<issued-key>. Run npm run sync. The downloaded ZIP contains NO key.\n\nEdit src/main.js and src/style.css freely. You may add local build tools/frameworks. Bundle everything inline in dist/index.html; no external network is available in the shared sandbox. Codex can upload text source files and the built HTML with lab_save_bundle.\n\nMembers, events, attendance, dues, boards and other test modules can use project-scoped collections through window.KLINE_LAB.records.list(name) and save(name,id,data,expectedVersion,archived). Use pagination through nextCursor. Records persist across UI versions; read the current version before updating. Archiving is reversible; there is no permanent-delete endpoint.\n\nThe starter is intentionally empty. No example club, members, dues or attendance records are included. Each account has its own private projects. The original owner/My project remains shared. Published applications use separate per-visitor records, never your development data.\n\nSource uploads preserve backend files for review, but do not execute custom backend code. Add production integrations or a new server runtime only through owner-approved isolated preview/review. Repository merge and public release always require the owner's separate approval.\n`,
    "tools/build.mjs": `import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
const result = await build({entryPoints:['src/main.js'],bundle:true,write:false,format:'iife',loader:{'.css':'text'},minify:true});
const script=result.outputFiles[0].text.replace(/<\\/script/gi,'<\\\\/script');
await mkdir('dist',{recursive:true});
await writeFile('dist/index.html','<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="app"></main><script>'+script+'</script></body></html>');
`,
    "tools/sync.mjs": `import { readFile,readdir,writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const base=new URL(process.env.KLINE_LAB_URL||${JSON.stringify(origin)});
if(base.protocol!=='https:'&&!(['localhost','127.0.0.1'].includes(base.hostname)&&base.protocol==='http:'))throw new Error('HTTPS required');
if(base.username||base.password||base.search||base.hash)throw new Error('Invalid lab origin');
const token=process.env.KLINE_LAB_TOKEN;if(!/^kll_[a-f0-9]{64}$/.test(token||''))throw new Error('Set the lab-issued KLINE_LAB_TOKEN locally');
let project;try{project=JSON.parse(await readFile('.lab-project.json','utf8'))}catch(error){if(error.code!=='ENOENT')throw error;project={id:randomUUID(),revision:0};await writeFile('.lab-project.json',JSON.stringify(project),{mode:0o600})}
const files={};for(const name of ['package.json','README.md','AGENTS.md','tools/build.mjs','tools/sync.mjs'])files[name]=await readFile(name,'utf8');
async function collect(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+entry.name;if(entry.isSymbolicLink())throw new Error('Source symlinks are not allowed');if(entry.isDirectory())await collect(path);else files[path]=await readFile(path,'utf8')}}await collect('src');
const client=new Client({name:'kline-lab-sync',version:'1.0.0'});
try{await client.connect(new StreamableHTTPClientTransport(new URL('/api/co-development/mcp',base),{requestInit:{headers:{Authorization:'Bearer '+token},redirect:'error'}}));
if(project.revision){const current=await client.callTool({name:'lab_get',arguments:{id:project.id}});if(current.isError)throw new Error('Cannot load current project');if(current.structuredContent.result.project.revision!==project.revision)throw new Error('Remote changed. Use Codex lab_get and lab_source to reconcile before syncing.');}
const result=await client.callTool({name:'lab_save_bundle',arguments:{id:project.id,expectedRevision:project.revision,title:'My project',description:'Private development',html:await readFile('dist/index.html','utf8'),fixture:{},files}});
if(result.isError)throw new Error(result.content[0].text);project.revision=result.structuredContent.result.project.revision;await writeFile('.lab-project.json',JSON.stringify(project),{mode:0o600});console.log('Saved private revision '+project.revision+' · '+new URL('/co-development',base));
}finally{await client.close()}
`,
    "src/style.css": `*{box-sizing:border-box}body{margin:0;background:#ffffff;color:#172323;font:15px system-ui}#app{min-height:100vh}\n`,
    "src/main.js": `import css from './style.css';
const style=document.createElement('style');style.textContent=css;document.head.append(style);
// Build your own interface here. Shared test data is available through window.KLINE_LAB.records.
`
  };
}
