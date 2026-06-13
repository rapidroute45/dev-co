import { InvoiceBillTo } from '../../domain/entities/invoiceBillTo.entity';
import { InvoiceBillToModel } from '../models/invoiceBillTo.model';

function mapDoc(doc: {
  _id: { toString(): string };
  name: string;
  address: string;
  updatedBy?: { toString(): string } | null;
  createdAt?: Date;
  updatedAt?: Date;
}): InvoiceBillTo {
  return new InvoiceBillTo({
    id: doc._id.toString(),
    name: doc.name,
    address: doc.address,
    updatedBy: doc.updatedBy?.toString() ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class InvoiceBillToRepository {
  async findAll(): Promise<InvoiceBillTo[]> {
    const docs = await InvoiceBillToModel.find().sort({ name: 1 });
    return docs.map(mapDoc);
  }

  async findByName(name: string): Promise<InvoiceBillTo | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const doc = await InvoiceBillToModel.findOne({
      name: new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });
    return doc ? mapDoc(doc) : null;
  }

  async upsert(input: {
    name: string;
    address: string;
    updatedBy: string;
  }): Promise<InvoiceBillTo> {
    const name = input.name.trim();
    const address = input.address.trim();
    if (!name) throw new Error('Bill-to name is required');
    if (!address) throw new Error('Bill-to address is required');

    const doc = await InvoiceBillToModel.findOneAndUpdate(
      { name },
      { name, address, updatedBy: input.updatedBy },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    if (!doc) throw new Error('Failed to save bill-to');
    return mapDoc(doc);
  }
}
