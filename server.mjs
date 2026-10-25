import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import passkey from './api/passkey.js';
const root=resolve('dist');
const port=Number(process.env.PORT)||4173;
process.env.APP_ORIGIN ||= `http://localhost:${port}`;
http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/api/passkey')return await passkey(req,res);const path=resolve(root,'.'+decodeURIComponent(pathname));if(!path.startsWith(root+sep)&&path!==root)throw Error();const file=path===root?resolve(root,'index.html'):path;const data=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.json':'application/json; charset=utf-8'})[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log('Local: http://localhost:'+port));

