import { Router } from 'express';
import { requireAuth } from '../../../../shared/middleware/auth.middleware';
import {
  voiceUploadMiddleware,
  documentUploadMiddleware,
} from '../../../../shared/upload/upload.config';
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
router.get('/group-candidates', controller.listGroupCandidates);
router.post('/conversations', controller.createConversation);
router.post('/conversations/internal', controller.createInternalConversation);
router.post('/conversations/open', controller.openConversation);
router.post('/groups', controller.createGroup);
router.patch('/groups/:id', controller.updateGroup);
router.post('/groups/:id/leave', controller.leaveGroup);
router.get('/conversations/:id/messages', controller.listMessages);
router.post('/conversations/:id/messages', controller.sendMessage);
router.post(
  '/conversations/:id/voice',
  voiceUploadMiddleware.single('audio'),
  controller.sendVoiceMessage
);
router.post(
  '/conversations/:id/attachment',
  documentUploadMiddleware.single('file'),
  controller.sendDocumentMessage
);

export default router;
export { chatService };
