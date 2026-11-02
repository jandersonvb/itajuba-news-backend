import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { isProduction, productionConfigProblems } from './config';

/** Stops a production start with an incomplete configuration before it serves anyone. */
function checkConfiguration() {
  if (!isProduction()) {
    if (!process.env.INTERNAL_API_KEY)
      Logger.warn(
        'INTERNAL_API_KEY não definida: o rate limit tratará todo o tráfego do frontend como um único IP.',
        'Bootstrap',
      );
    if (!process.env.RESEND_API_KEY && !process.env.SMTP_HOST)
      Logger.warn('Sem RESEND_API_KEY nem SMTP_HOST: os e-mails aparecerão neste log e em .mail-outbox/.', 'Bootstrap');
    return;
  }
  const { errors, warnings } = productionConfigProblems();
  for (const warning of warnings) Logger.warn(warning, 'Bootstrap');
  if (errors.length)
    throw new Error(
      'Configuração de produção incompleta (para desenvolvimento local, use NODE_ENV=development):\n- ' +
        errors.join('\n- '),
    );
}

async function bootstrap() {
  checkConfiguration();
  const app = configureApp(await NestFactory.create(AppModule));
  if (process.env.ENABLE_DOCS === 'true') {
    const config = new DocumentBuilder().setTitle('Itajubá News API').setVersion('0.1').addBearerAuth().build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }
  app.enableShutdownHooks();
  // No host: Node listens on IPv6 and IPv4 when the machine has IPv6. Railway's private network
  // is IPv6-only in environments created before 16/10/2025, so '0.0.0.0' would be unreachable there.
  await app.listen(Number(process.env.PORT || 4000));
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
