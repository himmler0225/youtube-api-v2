import { HttpException, HttpStatus } from '@nestjs/common';

export class EntityNotFoundException extends HttpException {
  constructor(entityName: string, id: number | string) {
    super(`${entityName} with id ${id} not found`, HttpStatus.NOT_FOUND);
  }
}

export class EntityAlreadyExistsException extends HttpException {
  constructor(entityName: string, field: string, value: any) {
    super(
      `${entityName} with ${field} '${value}' already exists`,
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidQueryException extends HttpException {
  constructor(message: string) {
    super(`Invalid query: ${message}`, HttpStatus.BAD_REQUEST);
  }
}

export class BulkOperationException extends HttpException {
  constructor(operation: string, errors: Error[]) {
    super(
      {
        message: `Bulk ${operation} operation failed`,
        errors: errors.map((e) => e.message),
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
