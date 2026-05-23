import { Router } from 'express';
import { requireAuth } from '../../../../shared/middleware/auth.middleware';
import { UserRepository } from '../../../auth/infrastructure/repositories/user.repository';
import { RouteRepository } from '../../../schedules/infrastructure/repositories/route.repository';
import { ChatService } from '../../application/services/chat.service';
import { ChatController } from '../controllers/chat.controller';

const router = Router();
const userRepo = new UserRepository();
const routeRepo = new RouteRepository();
const chatService = new ChatService(userRepo, routeRepo);
const controller = new ChatController(chatService);

router.use(requireAuth());

router.get('/conversations', controller.listConversations);
router.get('/drivers', controller.listDrivers);
router.post('/conversations', controller.createConversation);
router.post('/conversations/open', controller.openConversation);
router.get('/conversations/:id/messages', controller.listMessages);

export default router;
export { chatService };
