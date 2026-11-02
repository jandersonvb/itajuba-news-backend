import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { frontendOrigin } from './config';

/** HTTP setup shared by main.ts and the tests, so both run the same pipeline. */
export function configureApp<T extends INestApplication>(app: T) {
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({
    origin: frontendOrigin(),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });
  return app;
}
