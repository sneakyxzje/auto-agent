import { Injectable, type NestMiddleware } from '@nestjs/common';
import { enterRequestContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use = (_request: unknown, _response: unknown, next: () => void): void => {
    enterRequestContext(next);
  };
}
