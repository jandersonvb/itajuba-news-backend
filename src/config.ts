import 'dotenv/config';
import { entities } from './entities';
export function databaseOptions(){
 if(!process.env.DATABASE_URL) throw new Error('Defina DATABASE_URL no backend/.env');
 return {type:'postgres' as const,url:process.env.DATABASE_URL,entities,synchronize:false,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:false};
}
export function jwtSecret(){const s=process.env.JWT_SECRET;if(!s||s.length<32)throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres');return s;}
