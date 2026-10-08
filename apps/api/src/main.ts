import 'reflect-metadata';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { assertProductionConfig } from './security/production-config';

async function bootstrap() {
  assertProductionConfig();

  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableShutdownHooks();
  // The production API sits behind exactly one trusted Nginx reverse proxy.
  // Express otherwise records a Docker bridge IP (172.x) as the visitor IP.
  // Never blindly trust arbitrary X-Forwarded-For chains from the internet.
  const proxyHops=Number(process.env.TRUST_PROXY_HOPS ?? (process.env.NODE_ENV==='production'?'1':'0'));
  if(!Number.isInteger(proxyHops)||proxyHops<0||proxyHops>2)throw new Error('TRUST_PROXY_HOPS must be 0, 1 or 2');
  app.getHttpAdapter().getInstance().set('trust proxy',proxyHops);
  app.setGlobalPrefix('api');
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
  }));

  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? origins : true,
    credentials: true,
    methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
