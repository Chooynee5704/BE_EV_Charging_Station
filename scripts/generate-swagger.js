const fs = require('fs');
const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');

// IMPORTANT: run AFTER `tsc` so dist/config/openapi.js exists
const { swaggerDefinition, API_GLOBS } = require('../dist/config/openapi');

const spec = swaggerJSDoc({ definition: swaggerDefinition, apis: API_GLOBS });
const outDir = path.resolve(process.cwd(), 'dist');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'swagger.json'), JSON.stringify(spec, null, 2));
console.log('✔ Swagger spec generated at dist/swagger.json');
