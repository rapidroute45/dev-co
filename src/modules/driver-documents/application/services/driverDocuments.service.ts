import { AppError } from '../../../../shared/errors/app-error';
import { DocumentSubmissionStatus } from '../../../../shared/constants/documentStatuses';
import { UserRole, UserStatus } from '../../../../shared/constants/roles';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { DocumentRequirementModel } from '../../infrastructure/models/documentRequirement.model';
import { DriverDocumentSubmissionModel } from '../../infrastructure/models/driverDocumentSubmission.model';
import { DriverVehicleProfileModel } from '../../infrastructure/models/driverVehicleProfile.model';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import { NotificationType } from '../../../notifications/domain/entities/notification.entity';
import { Notification } from '../../../notifications/domain/entities/notification.entity';
import { INotificationRepository } from '../../../notifications/domain/interfaces/notification-repository.interface';
import { resolveDisplayName } from '../../../../shared/utils/displayName';

const DRIVER_ROLES = [UserRole.DRIVER, UserRole.TEAM_DRIVER];
const EXPIRING_SOON_DAYS = 30;

const DEFAULT_REQUIREMENTS = [
  {
    key: 'drivers_license',
    title: "Driver's License",
    category: 'identity',
    requiresExpiry: true,
    requiresReferenceNumber: true,
    referenceLabel: 'License No.',
    requiresFile: true,
  },
  {
    key: 'ssn_card',
    title: 'SSN Card',
    category: 'identity',
    requiresExpiry: false,
    requiresReferenceNumber: false,
    requiresFile: true,
  },
  {
    key: 'vehicle_registration',
    title: 'Vehicle Registration',
    category: 'vehicle',
    requiresExpiry: true,
    requiresReferenceNumber: true,
    referenceLabel: 'Plate No.',
    requiresFile: true,
  },
  {
    key: 'vehicle_insurance',
    title: 'Vehicle Insurance',
    category: 'vehicle',
    requiresExpiry: true,
    requiresReferenceNumber: true,
    referenceLabel: 'Policy No.',
    requiresFile: true,
  },
  {
    key: 'medical_card',
    title: 'Medical Card',
    category: 'compliance',
    requiresExpiry: true,
    requiresReferenceNumber: false,
    requiresFile: true,
  },
  {
    key: 'safety_training',
    title: 'Safety Training Certificate',
    category: 'compliance',
    requiresExpiry: true,
    requiresReferenceNumber: false,
    requiresFile: true,
  },
] as const;

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatExpiry(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

type RequirementDoc = {
  _id: { toString(): string };
  key: string;
  title: string;
  description?: string | null;
  category: string;
  requiresExpiry: boolean;
  requiresReferenceNumber: boolean;
  referenceLabel?: string | null;
  requiresFile: boolean;
  active: boolean;
};

type SubmissionDoc = {
  _id: { toString(): string };
  driverId: { toString(): string };
  requirementId: { toString(): string };
  status: string;
  referenceNumber?: string | null;
  expiryDate?: Date | null;
  fileUrl?: string | null;
  fileMimeType?: string | null;
  rejectionReason?: string | null;
  uploadedAt?: Date | null;
  verifiedAt?: Date | null;
};

export class DriverDocumentsService {
  constructor(
    private userRepo: IUserRepository,
    private notificationRepo: INotificationRepository
  ) {}

  private notificationService = new NotificationService(this.notificationRepo);

  async ensureDefaultRequirements(): Promise<void> {
    for (const req of DEFAULT_REQUIREMENTS) {
      await DocumentRequirementModel.updateOne(
        { key: req.key },
        { $setOnInsert: { ...req, active: true } },
        { upsert: true }
      );
    }
  }

  private computeStatus(
    submission: SubmissionDoc | null,
    requirement: RequirementDoc,
    today: Date
  ): DocumentSubmissionStatus {
    if (!submission?.fileUrl && requirement.requiresFile) {
      return DocumentSubmissionStatus.MISSING;
    }
    if (submission?.status === DocumentSubmissionStatus.REJECTED) {
      return DocumentSubmissionStatus.REJECTED;
    }
    if (submission?.status === DocumentSubmissionStatus.PENDING) {
      return DocumentSubmissionStatus.PENDING;
    }
    if (requirement.requiresExpiry && submission?.expiryDate) {
      const expiry = new Date(submission.expiryDate);
      expiry.setUTCHours(0, 0, 0, 0);
      if (expiry < today) return DocumentSubmissionStatus.EXPIRED;
      if (expiry <= addDays(today, EXPIRING_SOON_DAYS)) {
        return DocumentSubmissionStatus.EXPIRING_SOON;
      }
    }
    if (submission?.status === DocumentSubmissionStatus.VERIFIED) {
      return DocumentSubmissionStatus.VERIFIED;
    }
    if (submission?.fileUrl) {
      return DocumentSubmissionStatus.PENDING;
    }
    return DocumentSubmissionStatus.MISSING;
  }

  private mapRequirement(req: RequirementDoc) {
    return {
      id: req._id.toString(),
      key: req.key,
      title: req.title,
      description: req.description ?? null,
      category: req.category,
      requiresExpiry: req.requiresExpiry,
      requiresReferenceNumber: req.requiresReferenceNumber,
      referenceLabel: req.referenceLabel ?? null,
      requiresFile: req.requiresFile,
      active: req.active,
    };
  }

  private mapSubmission(
    submission: SubmissionDoc | null,
    requirement: RequirementDoc,
    today: Date
  ) {
    const status = this.computeStatus(submission, requirement, today);
    return {
      id: submission?._id?.toString() ?? null,
      requirementId: requirement._id.toString(),
      status,
      referenceNumber: submission?.referenceNumber ?? null,
      expiryDate: formatExpiry(submission?.expiryDate),
      fileUrl: submission?.fileUrl ?? null,
      fileMimeType: submission?.fileMimeType ?? null,
      rejectionReason: submission?.rejectionReason ?? null,
      uploadedAt: submission?.uploadedAt ?? null,
      verifiedAt: submission?.verifiedAt ?? null,
    };
  }

  private async getVehicleProfile(driverId: string) {
    const doc = await DriverVehicleProfileModel.findOne({ driverId });
    return {
      plateNumber: doc?.plateNumber ?? null,
      vehiclePhotoUrl: doc?.vehiclePhotoUrl ?? null,
      vehiclePhotoMimeType: doc?.vehiclePhotoMimeType ?? null,
    };
  }

  async listRequirements() {
    await this.ensureDefaultRequirements();
    const docs = await DocumentRequirementModel.find({ active: true }).sort({ title: 1 });
    return docs.map((d) => this.mapRequirement(d as RequirementDoc));
  }

  async getMyDocuments(driverId: string) {
    await this.ensureDefaultRequirements();
    const today = startOfTodayUtc();
    const requirements = await DocumentRequirementModel.find({ active: true }).sort({
      title: 1,
    });
    const submissions = await DriverDocumentSubmissionModel.find({ driverId });
    const byReq = new Map(
      submissions.map((s) => [(s as SubmissionDoc).requirementId.toString(), s as SubmissionDoc])
    );

    const documents = (requirements as RequirementDoc[]).map((req) => ({
      requirement: this.mapRequirement(req),
      submission: this.mapSubmission(byReq.get(req._id.toString()) ?? null, req, today),
    }));

    const stats = this.buildStats(documents.map((d) => d.submission.status));
    const vehicle = await this.getVehicleProfile(driverId);

    return { documents, stats, vehicle };
  }

  private buildStats(statuses: string[]) {
    const counts = {
      completed: 0,
      expiringSoon: 0,
      expired: 0,
      pending: 0,
      missing: 0,
      rejected: 0,
    };
    for (const s of statuses) {
      if (s === DocumentSubmissionStatus.VERIFIED) counts.completed++;
      else if (s === DocumentSubmissionStatus.EXPIRING_SOON) counts.expiringSoon++;
      else if (s === DocumentSubmissionStatus.EXPIRED) counts.expired++;
      else if (s === DocumentSubmissionStatus.PENDING) counts.pending++;
      else if (s === DocumentSubmissionStatus.REJECTED) counts.rejected++;
      else if (s === DocumentSubmissionStatus.MISSING) counts.missing++;
    }
    return counts;
  }

  async uploadDocument(
    driverId: string,
    requirementId: string,
    input: {
      fileUrl: string;
      fileMimeType: string;
      referenceNumber?: string;
      expiryDate?: string;
    }
  ) {
    const requirement = await DocumentRequirementModel.findById(requirementId);
    if (!requirement || !requirement.active) {
      throw new AppError('Document requirement not found.', 404);
    }

    const expiry =
      input.expiryDate && requirement.requiresExpiry
        ? new Date(`${input.expiryDate.trim()}T00:00:00.000Z`)
        : null;

    const patch = {
      driverId,
      requirementId,
      status: DocumentSubmissionStatus.PENDING,
      referenceNumber: input.referenceNumber?.trim() || null,
      expiryDate: expiry,
      fileUrl: input.fileUrl,
      fileMimeType: input.fileMimeType,
      rejectionReason: null,
      verifiedBy: null,
      verifiedAt: null,
      uploadedAt: new Date(),
    };

    const doc = await DriverDocumentSubmissionModel.findOneAndUpdate(
      { driverId, requirementId },
      { $set: patch },
      { upsert: true, returnDocument: 'after' }
    );

    const today = startOfTodayUtc();
    return {
      requirement: this.mapRequirement(requirement as RequirementDoc),
      submission: this.mapSubmission(doc as SubmissionDoc, requirement as RequirementDoc, today),
    };
  }

  async updateVehicleProfile(
    driverId: string,
    input: { plateNumber?: string; vehiclePhotoUrl?: string; vehiclePhotoMimeType?: string }
  ) {
    const patch: Record<string, unknown> = {};
    if (input.plateNumber !== undefined) {
      patch.plateNumber = input.plateNumber.trim().toUpperCase() || null;
    }
    if (input.vehiclePhotoUrl !== undefined) {
      patch.vehiclePhotoUrl = input.vehiclePhotoUrl;
      patch.vehiclePhotoMimeType = input.vehiclePhotoMimeType ?? null;
    }

    const doc = await DriverVehicleProfileModel.findOneAndUpdate(
      { driverId },
      { $set: patch },
      { upsert: true, returnDocument: 'after' }
    );

    return {
      plateNumber: doc?.plateNumber ?? null,
      vehiclePhotoUrl: doc?.vehiclePhotoUrl ?? null,
      vehiclePhotoMimeType: doc?.vehiclePhotoMimeType ?? null,
    };
  }

  async listDriversForManager() {
    const drivers = await this.userRepo.findActiveDrivers();
    const today = startOfTodayUtc();
    await this.ensureDefaultRequirements();
    const requirements = await DocumentRequirementModel.find({ active: true });

    const results = await Promise.all(
      drivers.map(async (driver) => {
        const driverId = driver.id!;
        const submissions = await DriverDocumentSubmissionModel.find({ driverId });
        const byReq = new Map(
          submissions.map((s) => [
            (s as SubmissionDoc).requirementId.toString(),
            s as SubmissionDoc,
          ])
        );
        const statuses = (requirements as RequirementDoc[]).map((req) =>
          this.computeStatus(byReq.get(req._id.toString()) ?? null, req, today)
        );
        const stats = this.buildStats(statuses);
        const pendingReview = statuses.filter(
          (s) => s === DocumentSubmissionStatus.PENDING
        ).length;

        return {
          id: driverId,
          email: driver.email,
          fullName: driver.fullName,
          displayName: resolveDisplayName(driver.fullName, driver.email),
          role: driver.role,
          teamId: driver.teamId,
          stats,
          pendingReview,
        };
      })
    );

    return results.sort((a, b) => b.pendingReview - a.pendingReview);
  }

  async getDriverDocumentsForManager(driverId: string) {
    const user = await this.userRepo.findById(driverId);
    if (!user || !user.role || !DRIVER_ROLES.includes(user.role)) {
      throw new AppError('Driver not found.', 404);
    }

    const payload = await this.getMyDocuments(driverId);
    return {
      driver: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        displayName: resolveDisplayName(user.fullName, user.email),
        role: user.role,
        teamId: user.teamId,
      },
      ...payload,
    };
  }

  async verifyDocument(
    managerId: string,
    driverId: string,
    requirementId: string
  ) {
    const doc = await DriverDocumentSubmissionModel.findOne({ driverId, requirementId });
    if (!doc?.fileUrl) throw new AppError('No document uploaded to verify.', 400);

    doc.status = DocumentSubmissionStatus.VERIFIED;
    doc.verifiedBy = managerId as unknown as typeof doc.verifiedBy;
    doc.verifiedAt = new Date();
    doc.rejectionReason = null;
    await doc.save();

    await this.notificationRepo.save(
      new Notification({
        recipientId: driverId,
        type: NotificationType.DOCUMENT_VERIFIED,
        title: 'Document verified',
        message: 'A document was approved by dispatch.',
        payload: { requirementId },
        read: false,
      })
    );

    return this.getDriverDocumentsForManager(driverId);
  }

  async rejectDocument(
    managerId: string,
    driverId: string,
    requirementId: string,
    reason?: string
  ) {
    const doc = await DriverDocumentSubmissionModel.findOne({ driverId, requirementId });
    if (!doc) throw new AppError('Document submission not found.', 404);

    doc.status = DocumentSubmissionStatus.REJECTED;
    doc.rejectionReason = reason?.trim() || 'Please re-upload.';
    doc.verifiedBy = null;
    doc.verifiedAt = null;
    await doc.save();

    await this.notificationRepo.save(
      new Notification({
        recipientId: driverId,
        type: NotificationType.DOCUMENT_REJECTED,
        title: 'Document needs attention',
        message: doc.rejectionReason,
        payload: { requirementId },
        read: false,
      })
    );

    return this.getDriverDocumentsForManager(driverId);
  }

  async createRequirement(
    managerId: string,
    body: {
      title: string;
      description?: string;
      category?: 'identity' | 'vehicle' | 'compliance';
      requiresExpiry?: boolean;
      requiresReferenceNumber?: boolean;
      referenceLabel?: string;
      requiresFile?: boolean;
    }
  ) {
    const key = body.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 48);

    const existing = await DocumentRequirementModel.findOne({ key });
    if (existing) throw new AppError('A requirement with a similar key already exists.', 400);

    const created = (await DocumentRequirementModel.create({
      key: `${key}_${Date.now().toString(36)}`,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      category: body.category ?? 'compliance',
      requiresExpiry: body.requiresExpiry ?? true,
      requiresReferenceNumber: body.requiresReferenceNumber ?? false,
      referenceLabel: body.referenceLabel?.trim() || null,
      requiresFile: body.requiresFile ?? true,
      active: true,
      createdBy: managerId,
    })) as RequirementDoc;

    const drivers = await this.userRepo.findActiveDrivers();
    await Promise.all(
      drivers.map((driver) =>
        this.notificationRepo.save(
          new Notification({
            recipientId: driver.id!,
            type: NotificationType.DOCUMENT_REQUIRED,
            title: 'New document required',
            message: `Please upload: ${created.title}`,
            payload: { requirementId: created._id.toString() as string },
            read: false,
          })
        )
      )
    );

    return this.mapRequirement(created);
  }

  async updateRequirement(
    requirementId: string,
    body: {
      title?: string;
      description?: string;
      category?: 'identity' | 'vehicle' | 'compliance';
      requiresExpiry?: boolean;
      requiresReferenceNumber?: boolean;
      referenceLabel?: string;
      requiresFile?: boolean;
    }
  ) {
    const existing = await DocumentRequirementModel.findById(requirementId);
    if (!existing || !existing.active) {
      throw new AppError('Document requirement not found.', 404);
    }

    if (body.title !== undefined && !body.title.trim()) {
      throw new AppError('title cannot be empty.', 400);
    }

    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = body.title.trim();
    if (body.description !== undefined) patch.description = body.description?.trim() || null;
    if (body.category !== undefined) patch.category = body.category;
    if (body.requiresExpiry !== undefined) patch.requiresExpiry = body.requiresExpiry;
    if (body.requiresReferenceNumber !== undefined) {
      patch.requiresReferenceNumber = body.requiresReferenceNumber;
    }
    if (body.referenceLabel !== undefined) patch.referenceLabel = body.referenceLabel?.trim() || null;
    if (body.requiresFile !== undefined) patch.requiresFile = body.requiresFile;

    const updated = await DocumentRequirementModel.findByIdAndUpdate(
      requirementId,
      { $set: patch },
      { returnDocument: 'after' }
    );
    if (!updated) throw new AppError('Document requirement not found.', 404);

    const drivers = await this.userRepo.findActiveDrivers();
    const title = updated.title;
    await Promise.all(
      drivers.map((driver) =>
        this.notificationRepo.save(
          new Notification({
            recipientId: driver.id!,
            type: NotificationType.DOCUMENT_UPDATED,
            title: 'Document requirement updated',
            message: `Please review: ${title}`,
            payload: { requirementId: updated._id.toString() },
            read: false,
          })
        )
      )
    );

    return this.mapRequirement(updated as RequirementDoc);
  }

  async deleteRequirement(requirementId: string) {
    const existing = await DocumentRequirementModel.findById(requirementId);
    if (!existing || !existing.active) {
      throw new AppError('Document requirement not found.', 404);
    }

    await DocumentRequirementModel.findByIdAndUpdate(requirementId, {
      $set: { active: false },
    });

    return { id: requirementId, deleted: true };
  }
}
