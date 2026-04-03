import { Injectable } from "@nestjs/common";
import { APP_NAME } from "@repo/contracts";

@Injectable()
export class AppService {
  getHello(): { message: string } {
    return { message: `Hello from API, shared APP_NAME=${APP_NAME}` };
  }

  getHealth(): { ok: boolean } {
    return { ok: true };
  }
}
