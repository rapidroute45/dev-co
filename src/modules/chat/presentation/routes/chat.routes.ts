import { Router } from 'express';
import { requireAuth } from '../../../../shared/middleware/auth.middleware';
import { voiceUploadMiddleware } from '../../../../shared/upload/upload.config';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { RouteRepository } from '../../../schedules/infrastructure/repositories/route.repository';
import { ChatService } from '../../application/services/chat.service';
import { ChatController } from '../controllers/chat.controller';
import { emitNewChatMessage } from '../../socket/chat.socket';

const router = Router();
const userRepo = new UserRepository();
const routeRepo = new RouteRepository();
const chatService = new ChatService(userRepo, routeRepo);
const controller = new ChatController(chatService, emitNewChatMessage);

router.use(requireAuth());

router.get('/conversations', controller.listConversations);
router.get('/drivers', controller.listDrivers);
router.post('/conversations', controller.createConversation);
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
