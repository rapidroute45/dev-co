import { Router } from 'express';
import { requireAuth } from '../../../../shared/middleware/auth.middleware';
import { voiceUploadMiddleware } from '../../../../shared/upload/upload.config';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { RouteRepository } from '../../../schedules/infrastructure/repositories/route.repository';
import { ScheduleRepository } from '../../../schedules/infrastructure/repositories/schedule.repository';
import { ChatService } from '../../application/services/chat.service';
import { ChatController } from '../controllers/chat.controller';
import { emitNewChatMessage } from '../../socket/chat.socket';

const router = Router();
const userRepo = new UserRepository();
const routeRepo = new RouteRepository();
const scheduleRepo = new ScheduleRepository();
const chatService = new ChatService(userRepo, routeRepo, scheduleRepo);
const controller = new ChatController(chatService, emitNewChatMessage);

router.use(requireAuth());

router.get('/conversations', controller.listConversations);
router.get('/drivers', controller.listDrivers);
router.get('/ops-peers', controller.listOpsPeers);
router.post('/conversations', controller.createConversation);
router.post('/conversations/internal', controller.createInternalConversation);
router.post('/conversations/open', controller.openConversation);
router.get('/conversations/:id/messages', controller.listMessages);
router.post('/conversations/:id/messages', controller.sendMessage);
router.post(
  '/conversations/:id/voice',
  voiceUploadMiddleware.single('audio'),
  controller.sendVoiceMessage
);

export default router;
export { chatService };
