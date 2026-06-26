import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS
  app.enableCors({ origin: '*' });

  // Cookie parser & form body
  app.use(cookieParser());
  app.useBodyParser('urlencoded', { extended: true });

  // Swagger docs with cache prevention
  const swaggerPath = 'api-docs';

  app.use(`/${swaggerPath}`, (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  const config = new DocumentBuilder()
    .setTitle('A | Cap Quiz Bot API')
    .setDescription('Telegram quiz bot backend for A | Cap financial risk assessment')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(swaggerPath, app, document, {
    customSiteTitle: 'A | Cap Quiz Bot API',
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 30px 0; }
      .swagger-ui .info .title { font-size: 2em; color: #1a1a2e; }
      .swagger-ui .scheme-container { background: #f8f9fa; padding: 15px; border-radius: 8px; }
      body { background-color: #fafbfc; }
    `,
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Service running on port ${port}`);
  logger.log(`API docs at http://localhost:${port}/${swaggerPath}`);
}
bootstrap();
