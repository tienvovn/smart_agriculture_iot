import { hardwareBridgeService } from '../services/HardwareBridgeService.js';
import { iotMvpService } from '../services/IotMvpService.js';
import { realtimeService } from '../services/RealtimeService.js';
import { getTelemetryTrend } from '../services/TelemetryTrendService.js';
import { telemetryPipelineService } from '../services/TelemetryPipelineService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const iotMvpController = {
  snapshot: asyncHandler(async (req, res) => {
    return sendSuccess(res, 200, 'IoT snapshot retrieved successfully', await iotMvpService.getSnapshot());
  }),

  telemetryTrend: asyncHandler(async (req, res) => {
    const data = await getTelemetryTrend(req.query);
    return sendSuccess(res, 200, 'Telemetry trend retrieved successfully', data);
  }),

  telemetryStorage: asyncHandler(async (req, res) => {
    return sendSuccess(res, 200, 'Telemetry storage statistics retrieved', await telemetryPipelineService.storageStats());
  }),

  stream(req, res) {
    realtimeService.connect(req, res);
  },

  startAckTimeout: asyncHandler(async (req, res) => {
    const data = await iotMvpService.startAckTimeoutScenario(req.body.farmCode);
    return sendSuccess(res, 200, 'ACK timeout scenario started', data);
  }),

  startSilentFailure: asyncHandler(async (req, res) => {
    const data = await iotMvpService.startSilentFailureScenario(req.body.farmCode);
    return sendSuccess(res, 200, 'Silent pump failure scenario started', data);
  }),

  restoreController: asyncHandler(async (req, res) => {
    const data = await iotMvpService.restorePumpController(req.body.farmCode);
    return sendSuccess(res, 200, 'Pump controller restored', data);
  }),

  retryIncident: asyncHandler(async (req, res) => {
    const data = await iotMvpService.retryIncident(req.params.incidentId);
    return sendSuccess(res, 200, 'Incident mitigation started', data);
  }),

  hardwareStatus: asyncHandler(async (req, res) => {
    return sendSuccess(res, 200, 'Hardware devices retrieved', hardwareBridgeService.status());
  }),

  hardwareCommand: asyncHandler(async (req, res) => {
    const data = await hardwareBridgeService.sendCommand(req.params.farmCode, req.body.action);
    return sendSuccess(res, 202, 'Command published to the device', data);
  }),

  incidentKpis: asyncHandler(async (req, res) => {
    const hours = Math.min(Math.max(Number(req.query.hours) || 24, 1), 24 * 30);
    return sendSuccess(res, 200, 'Incident KPIs retrieved', await iotMvpService.getIncidentKpis({ hours }));
  }),

  incidentEvidence: asyncHandler(async (req, res) => {
    const data = await iotMvpService.getIncidentEvidence(req.params.incidentId);
    return sendSuccess(res, 200, 'Incident recovery evidence retrieved', data);
  }),

  resetScenario: asyncHandler(async (req, res) => {
    const data = await iotMvpService.resetScenario(req.body.farmCode);
    return sendSuccess(res, 200, 'Scenario reset', data);
  })
};
