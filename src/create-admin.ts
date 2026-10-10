import db from './data-source';
import { Portal,User } from './entities';
import { hashPassword } from './password';
async function main(){const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();const password=process.env.ADMIN_PASSWORD;if(!email||!email.includes('@')||!password||password.length<12)throw new Error('Defina ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 12 caracteres) no ambiente.');await db.initialize();try{const portal=await db.getRepository(Portal).findOneByOrFail({slug:process.env.PORTAL_SLUG||'itajuba-news'});if(await db.getRepository(User).findOneBy({email,portalId:portal.id}))throw new Error('Administrador já existe. Nenhuma senha foi alterada.');await db.getRepository(User).save({email,passwordHash:hashPassword(password),portalId:portal.id,active:true});console.log('Administrador criado.');}finally{await db.destroy()}}
main().catch(e=>{console.error(e.message);process.exitCode=1});
