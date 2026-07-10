import { analyticsService } from '../services/AnalyticsService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const analyticsController = {
  getDashboard: asyncHandler(async (req, res) => {
    const summary = await analyticsService.getDashboard();
    return sendSuccess(res, 200, 'Dashboard summary retrieved successfully', summary);
  }),
  getStatistics: asyncHandler(async (req, res) => {
    const statistics = await analyticsService.getStatistics();
    return sendSuccess(res, 200, 'Statistics retrieved successfully', statistics);
  })
};
