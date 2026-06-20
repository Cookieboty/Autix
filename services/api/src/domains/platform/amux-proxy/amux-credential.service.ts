import { Injectable } from '@nestjs/common';
import { AmuxCredentialRepository } from './amux-credential.repository';

@Injectable()
export class AmuxCredentialService {
  constructor(private readonly repository: AmuxCredentialRepository) {}

  async get(userId: string) {
    return this.repository.findByUserId(userId);
  }

  async upsert(userId: string, data: { host: string; oat: string; amuxUserId: number }) {
    return this.repository.upsert(userId, data);
  }

  async delete(userId: string) {
    return this.repository.deleteByUserId(userId);
  }
}
