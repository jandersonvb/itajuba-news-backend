import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule,DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
async function main(){const app=await NestFactory.create(AppModule);app.use(helmet());app.setGlobalPrefix('api');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.enableCors({origin:process.env.FRONTEND_ORIGIN||'http://localhost:3000',methods:['GET','POST','PATCH','DELETE']});if(process.env.ENABLE_DOCS==='true'){const doc=SwaggerModule.createDocument(app,new DocumentBuilder().setTitle('Itajubá News API').setVersion('0.1').addBearerAuth().build());SwaggerModule.setup('api/docs',app,doc);}app.enableShutdownHooks();await app.listen(Number(process.env.PORT||4000),'0.0.0.0');}
main().catch(e=>{console.error(e);process.exit(1)});
