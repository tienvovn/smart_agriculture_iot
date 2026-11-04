import { Router } from 'express';
import { analyticsController } from '../controllers/AnalyticsController.js';
import farmRoutes from './farmRoutes.js';
import mqttLogRoutes from './mqttLogRoutes.js';
import pumpLogRoutes from './pumpLogRoutes.js';
import sensorRoutes from './sensorRoutes.js';
import sensorLogRoutes from './sensorLogRoutes.js';
import userRoutes from './userRoutes.js';
import weatherLogRoutes from './weatherLogRoutes.js';
import iotMvpRoutes from './iotMvpRoutes.js';

const router = Router();

router.use('/farms', farmRoutes);
router.use('/sensors', sensorRoutes);
router.use('/sensor-logs', sensorLogRoutes);
router.use('/pump-logs', pumpLogRoutes);
router.use('/weather-logs', weatherLogRoutes);
router.use('/mqtt-logs', mqttLogRoutes);
router.use('/users', userRoutes);
router.get('/dashboard', analyticsController.getDashboard);
router.get('/statistics', analyticsController.getStatistics);
router.use('/iot', iotMvpRoutes);

export default router;
