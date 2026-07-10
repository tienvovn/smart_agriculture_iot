import swaggerJSDoc from 'swagger-jsdoc';

const objectId = '507f1f77bcf86cd799439011';

const paginationParameters = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 20 } },
  { name: 'search', in: 'query', schema: { type: 'string' } },
  { name: 'sort', in: 'query', schema: { type: 'string', example: '-createdAt' } }
];

const resources = [
  {
    path: '/farms', tag: 'Farms', name: 'Farm', schema: 'Farm', required: ['name', 'code', 'owner'],
    filters: [{ name: 'owner', type: 'string' }, { name: 'status', enum: ['active', 'maintenance', 'inactive'] }, { name: 'cropType', type: 'string' }],
    example: { name: 'Green Valley Farm', code: 'GVF-01', owner: objectId, cropType: 'Mixed vegetables', status: 'active', location: { address: '123 Rural Road', city: 'Da Lat', country: 'Vietnam', geo: { type: 'Point', coordinates: [108.438, 11.9404] } }, thresholds: { humidityMin: 50, pumpRunMinutes: 30, temperatureMin: 16, temperatureMax: 38, soilPhMin: 5.5, soilPhMax: 7.5 }, pump: { status: 'off', mode: 'auto' } }
  },
  {
    path: '/sensors', tag: 'Sensors', name: 'Sensor', schema: 'Sensor', required: ['farm', 'name', 'type', 'unit', 'deviceId', 'mqttTopic'],
    filters: [{ name: 'farm', type: 'string' }, { name: 'type', enum: ['temperature', 'humidity', 'soil_ph'] }, { name: 'unit', enum: ['celsius', 'percent', 'ph'] }, { name: 'status', enum: ['online', 'offline', 'maintenance'] }],
    example: { farm: objectId, name: 'Greenhouse Temperature', type: 'temperature', unit: 'celsius', deviceId: 'temp-001', mqttTopic: 'farms/gvf-01/sensors/temp-001', status: 'online', lastValue: 26.4, lastReadingAt: '2026-07-11T08:30:00.000Z', calibrationOffset: 0 }
  },
  {
    path: '/sensor-logs', tag: 'Sensor logs', name: 'Sensor log', schema: 'SensorLog', required: ['farm', 'sensor', 'sensorType', 'value', 'unit'],
    filters: [{ name: 'farm', type: 'string' }, { name: 'sensor', type: 'string' }, { name: 'sensorType', enum: ['temperature', 'humidity', 'soil_ph'] }, { name: 'unit', enum: ['celsius', 'percent', 'ph'] }, { name: 'source', enum: ['simulator', 'mqtt', 'manual'] }],
    example: { farm: objectId, sensor: objectId, sensorType: 'temperature', value: 26.4, unit: 'celsius', source: 'mqtt', capturedAt: '2026-07-11T08:30:00.000Z', metadata: { weatherLog: null, mqttLog: null } }
  },
  {
    path: '/pump-logs', tag: 'Pump logs', name: 'Pump log', schema: 'PumpLog', required: ['farm', 'action', 'trigger', 'mode'],
    filters: [{ name: 'farm', type: 'string' }, { name: 'requestedBy', type: 'string' }, { name: 'action', enum: ['turned_on', 'turned_off'] }, { name: 'trigger', enum: ['auto_humidity_low', 'auto_duration_complete', 'manual', 'system'] }, { name: 'mode', enum: ['auto', 'manual'] }],
    example: { farm: objectId, action: 'turned_on', trigger: 'auto_humidity_low', mode: 'auto', humidityValue: 42, threshold: 50, runDurationMinutes: 30, occurredAt: '2026-07-11T08:30:00.000Z' }
  },
  {
    path: '/weather-logs', tag: 'Weather logs', name: 'Weather log', schema: 'WeatherLog', required: ['farm', 'condition', 'temperatureDelta', 'humidityDelta', 'temperatureAfter', 'humidityAfter'],
    filters: [{ name: 'farm', type: 'string' }, { name: 'condition', enum: ['sunny', 'cloudy', 'rainy', 'storm', 'dry', 'windy'] }],
    example: { farm: objectId, condition: 'sunny', temperatureDelta: 2.3, humidityDelta: -6, temperatureAfter: 28.7, humidityAfter: 54, simulatedAt: '2026-07-11T08:30:00.000Z' }
  },
  {
    path: '/mqtt-logs', tag: 'MQTT logs', name: 'MQTT log', schema: 'MqttLog', required: ['topic', 'direction', 'payload'],
    filters: [{ name: 'farm', type: 'string' }, { name: 'sensor', type: 'string' }, { name: 'direction', enum: ['incoming', 'outgoing'] }, { name: 'messageType', enum: ['sensor_reading', 'pump_command', 'device_status', 'unknown'] }, { name: 'qos', type: 'integer' }, { name: 'retained', type: 'boolean' }, { name: 'processingStatus', enum: ['pending', 'processed', 'failed'] }],
    example: { farm: objectId, sensor: objectId, topic: 'farms/gvf-01/sensors/temp-001', direction: 'incoming', messageType: 'sensor_reading', payload: { value: 26.4, unit: 'celsius' }, qos: 1, retained: false, receivedAt: '2026-07-11T08:30:00.000Z', processingStatus: 'processed' }
  },
  {
    path: '/users', tag: 'Users', name: 'User', schema: 'User', required: ['fullName', 'email', 'passwordHash'],
    filters: [{ name: 'role', enum: ['admin', 'operator', 'viewer'] }, { name: 'isActive', type: 'boolean' }],
    example: { fullName: 'Nguyen Van An', email: 'an@example.com', passwordHash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', role: 'operator', isActive: true }
  }
];

const response = (description, schema, example, status = '200') => ({
  [status]: { description, content: { 'application/json': { schema, example } } },
  '400': { $ref: '#/components/responses/ValidationError' },
  '404': { $ref: '#/components/responses/NotFound' },
  '500': { $ref: '#/components/responses/ServerError' }
});

const success = (data, message, meta) => ({ success: true, message, data, ...(meta ? { meta } : {}) });
const dataSchema = (schema) => ({ allOf: [{ $ref: '#/components/schemas/SuccessResponse' }], properties: { data: { $ref: `#/components/schemas/${schema}` } } });

function resourcePaths(resource) {
  const parameters = [...paginationParameters, ...resource.filters.map((filter) => ({ name: filter.name, in: 'query', schema: filter.enum ? { type: 'string', enum: filter.enum } : { type: filter.type } }))];
  const requestSchema = { $ref: `#/components/schemas/${resource.schema}Input` };
  const itemResponse = response(`${resource.name} returned successfully`, dataSchema(resource.schema), success({ _id: objectId, ...resource.example }, `${resource.name} retrieved successfully`));
  const listSchema = { allOf: [{ $ref: '#/components/schemas/SuccessResponse' }], properties: { data: { type: 'array', items: { $ref: `#/components/schemas/${resource.schema}` } }, meta: { $ref: '#/components/schemas/PaginationMeta' } } };

  return {
    [resource.path]: {
      get: { tags: [resource.tag], summary: `List ${resource.name.toLowerCase()} records`, parameters, responses: response('Records returned successfully', listSchema, success([{ _id: objectId, ...resource.example }], `${resource.name} records retrieved successfully`, { page: 1, limit: 20, total: 1, totalPages: 1 })) },
      post: { tags: [resource.tag], summary: `Create a ${resource.name.toLowerCase()}`, requestBody: { required: true, content: { 'application/json': { schema: requestSchema, example: resource.example } } }, responses: response(`${resource.name} created`, dataSchema(resource.schema), success({ _id: objectId, ...resource.example }, `${resource.name} created successfully`), '201') }
    },
    [`${resource.path}/{id}`]: {
      parameters: [{ $ref: '#/components/parameters/Id' }],
      get: { tags: [resource.tag], summary: `Get a ${resource.name.toLowerCase()} by ID`, responses: itemResponse },
      put: { tags: [resource.tag], summary: `Replace a ${resource.name.toLowerCase()}`, requestBody: { required: true, content: { 'application/json': { schema: requestSchema, example: resource.example } } }, responses: response(`${resource.name} updated`, dataSchema(resource.schema), success({ _id: objectId, ...resource.example }, `${resource.name} updated successfully`)) },
      patch: { tags: [resource.tag], summary: `Update part of a ${resource.name.toLowerCase()}`, requestBody: { required: true, content: { 'application/json': { schema: requestSchema, example: resource.example } } }, responses: response(`${resource.name} updated`, dataSchema(resource.schema), success({ _id: objectId, ...resource.example }, `${resource.name} updated successfully`)) },
      delete: { tags: [resource.tag], summary: `Delete a ${resource.name.toLowerCase()}`, responses: response(`${resource.name} deleted`, dataSchema(resource.schema), success({ _id: objectId, ...resource.example }, `${resource.name} deleted successfully`)) }
    }
  };
}

const schemas = Object.fromEntries(resources.flatMap((resource) => [
  [resource.schema, { type: 'object', properties: { _id: { type: 'string', example: objectId }, ...Object.fromEntries(Object.keys(resource.example).map((key) => [key, { description: key, example: resource.example[key] }])), createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' } } }],
  [`${resource.schema}Input`, { type: 'object', required: resource.required, properties: Object.fromEntries(Object.keys(resource.example).map((key) => [key, { description: key, example: resource.example[key] }])) }]
]));

const paths = Object.assign({}, ...resources.map(resourcePaths), {
  '/health': {
    get: { tags: ['System'], summary: 'Check API and database health', responses: { '200': { description: 'Database connected', content: { 'application/json': { example: { status: 'OK', database: 'Connected' } } } }, '503': { description: 'Database unavailable', content: { 'application/json': { example: { status: 'UNAVAILABLE', database: 'Disconnected' } } } } } }
  },
  '/dashboard': {
    get: { tags: ['Analytics'], summary: 'Get dashboard summary', responses: response('Dashboard summary returned', { $ref: '#/components/schemas/SuccessResponse' }, success({ totalFarms: 2, totalSensors: 6, onlineSensors: 5, averageTemperature: 26.4, averageHumidity: 58.2, averagePH: 6.4, activePumps: 1, todayPumpCount: 4 }, 'Dashboard summary retrieved successfully')) }
  },
  '/statistics': {
    get: { tags: ['Analytics'], summary: 'Get farm statistics', responses: response('Statistics returned', { $ref: '#/components/schemas/SuccessResponse' }, success({ averageTemperature: 26.4, averageHumidity: 58.2, averagePH: 6.4, pumpUsage: { turned_on: 4, turned_off: 3 }, farmCount: 2, sensorCount: 6, weatherDistribution: { cloudy: 1, sunny: 3 } }, 'Statistics retrieved successfully')) }
  }
});

// Resource and analytics routes are mounted under /api, while /health is mounted at the app root.
const documentedPaths = Object.fromEntries(
  Object.entries(paths).map(([path, definition]) => [path === '/health' ? path : `/api${path}`, definition])
);

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.3',
    info: { title: 'Smart Farm IoT API', version: '1.0.0', description: 'REST API documentation for the Smart Agriculture IoT dashboard.' },
    servers: [{ url: '/', description: 'Current server' }],
    tags: [{ name: 'System' }, { name: 'Analytics' }, ...resources.map(({ tag }) => ({ name: tag }))],
    paths: documentedPaths,
    components: {
      parameters: { Id: { name: 'id', in: 'path', required: true, description: 'MongoDB ObjectId', schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$', example: objectId } } },
      schemas: {
        SuccessResponse: { type: 'object', required: ['success', 'message'], properties: { success: { type: 'boolean', example: true }, message: { type: 'string' }, data: {}, meta: { $ref: '#/components/schemas/PaginationMeta' } } },
        PaginationMeta: { type: 'object', properties: { page: { type: 'integer', example: 1 }, limit: { type: 'integer', example: 20 }, total: { type: 'integer', example: 1 }, totalPages: { type: 'integer', example: 1 } } },
        ErrorResponse: { type: 'object', properties: { success: { type: 'boolean', example: false }, message: { type: 'string' }, details: { type: 'array', items: { type: 'object' } } } },
        ...schemas
      },
      responses: {
        ValidationError: { description: 'Request validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { success: false, message: 'Validation failed', details: [{ field: 'name', message: 'Invalid value' }] } } } },
        NotFound: { description: 'Resource or route not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { success: false, message: 'Resource not found' } } } },
        ServerError: { description: 'Unexpected server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { success: false, message: 'Internal server error' } } } }
      }
    }
  },
  apis: []
});
