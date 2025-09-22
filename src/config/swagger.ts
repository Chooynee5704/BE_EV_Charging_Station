// src/config/swagger.ts
import swaggerJsdoc, { Options } from 'swagger-jsdoc';
import fs from 'fs';
import path from 'path';
import { swaggerDefinition, API_GLOBS } from './openapi';

/**
 * Build specs from prebuilt JSON (dist/swagger.json) if available,
 * otherwise generate from JSDoc/YAML. Then patch servers at runtime.
 */
function buildSpecs(): any {
  const jsonPath = path.join(__dirname, '..', 'swagger.json');
  let specs: any;

  // 1) Prefer prebuilt spec (created at build time)
  if (fs.existsSync(jsonPath)) {
    try {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      specs = JSON.parse(raw);
    } catch (err) {
      console.warn('⚠️ Failed to parse dist/swagger.json, falling back to JSDoc generation.', err);
    }
  }

  // 2) Fallback: generate from source globs
  if (!specs) {
    const options: Options = {
      // swaggerDefinition includes info/servers/components/tags
      definition: swaggerDefinition as any,
      // scan TS/YAML in src (dev) — do NOT scan dist to avoid duplicates
      apis: API_GLOBS,
    };
    specs = swaggerJsdoc(options);
  }

  // 3) Runtime patch: force correct server url in production
  //    This overrides whatever got baked into dist/swagger.json.
  if (process.env.NODE_ENV === 'production') {
    const serverUrl =
      process.env.SWAGGER_SERVER_URL || // best: set to "/" (or "/api" if mounted)
      process.env.SWAGGER_BASE_PATH ||  // e.g. "/api"
      '/';                              // safe relative default behind proxy
    specs.servers = [{ url: serverUrl, description: 'Production (patched at runtime)' }];
  } else {
    // In dev, if user explicitly sets SWAGGER_SERVER_URL, respect it
    if (process.env.SWAGGER_SERVER_URL) {
      specs.servers = [{ url: process.env.SWAGGER_SERVER_URL, description: 'Dev (overridden by env)' }];
    }
  }

  // 4) Sanity: ensure components exist to avoid $ref -> "string" issue
  specs.components = specs.components || {};
  specs.components.schemas = specs.components.schemas || {};

  return specs;
}

export const specs = buildSpecs();
export default specs;
