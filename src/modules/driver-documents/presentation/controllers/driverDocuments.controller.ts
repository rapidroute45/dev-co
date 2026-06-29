import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../shared/errors/app-error';
import { publicUploadPath } from '../../../../shared/upload/upload.config';
import { DriverDocumentsService } from '../../application/services/driverDocuments.service';

export class DriverDocumentsController {
  constructor(private service: DriverDocumentsService) {}

  listRequirements = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.listRequirements();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getMyDocuments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.service.getMyDocuments(req.user.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  uploadDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const file = req.file;
      if (!file) return next(new AppError('File is required.', 400));

      const requirementId = String(req.params.requirementId);
      const fileUrl = publicUploadPath(file.filename);

      const data = await this.service.uploadDocument(req.user.id, requirementId, {
        fileUrl,
        fileMimeType: file.mimetype,
        referenceNumber: req.body.referenceNumber,
        expiryDate: req.body.expiryDate,
      });

      res.status(200).json({
        success: true,
        message: 'Document uploaded. Awaiting verification.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  updateVehiclePlate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.service.updateVehicleProfile(req.user.id, {
        plateNumber: req.body.plateNumber,
      });
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  updateVehicle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));

      let vehiclePhotoUrl: string | undefined;
      let vehiclePhotoMimeType: string | undefined;
      if (req.file) {
        vehiclePhotoUrl = publicUploadPath(req.file.filename);
        vehiclePhotoMimeType = req.file.mimetype;
      }

      const data = await this.service.updateVehicleProfile(req.user.id, {
        plateNumber: req.body.plateNumber,
        vehiclePhotoUrl,
        vehiclePhotoMimeType,
      });

      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  listDrivers = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.listDriversForManager();
      res.status(200).json({ success: true, data, count: data.length });
    } catch (error) {
      next(error);
    }
  };

  getDriverDocuments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getDriverDocumentsForManager(String(req.params.driverId));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  verifyDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.service.verifyDocument(
        req.user.id,
        String(req.params.driverId),
        String(req.params.requirementId)
      );
      res.status(200).json({ success: true, message: 'Document verified.', data });
    } catch (error) {
      next(error);
    }
  };

  requestDocumentUpload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.requestDocumentUpload(
        String(req.params.driverId),
        String(req.params.requirementId)
      );
      res.status(200).json({
        success: true,
        message: 'Driver was notified to upload this document.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  rejectDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.service.rejectDocument(
        req.user.id,
        String(req.params.driverId),
        String(req.params.requirementId),
        req.body.reason
      );
      res.status(200).json({ success: true, message: 'Document rejected.', data });
    } catch (error) {
      next(error);
    }
  };

  updateRequirement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.service.updateRequirement(
        String(req.params.requirementId),
        req.body
      );
      res.status(200).json({
        success: true,
        message: 'Requirement updated. Drivers were notified.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteRequirement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.service.deleteRequirement(String(req.params.requirementId));
      res.status(200).json({
        success: true,
        message: 'Requirement removed.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  createRequirement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      if (!req.body.title?.trim()) {
        return next(new AppError('title is required.', 400));
      }
      const data = await this.service.createRequirement(req.user.id, req.body);
      res.status(201).json({
        success: true,
        message: 'Requirement created. Drivers were notified.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
