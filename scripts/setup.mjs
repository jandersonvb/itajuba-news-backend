import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
const target=new URL('../.env',import.meta.url);
if(!existsSync(target)){let text=readFileSync(new URL('../.env.example',import.meta.url),'utf8');text=text.replace('JWT_SECRET=','JWT_SECRET='+randomBytes(48).toString('hex'));writeFileSync(target,text,{mode:0o600});console.log('Configuração local criada.');}else console.log('Configuração existente preservada.');
