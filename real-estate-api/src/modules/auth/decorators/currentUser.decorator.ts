import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Nếu có truyền tham số (ví dụ: 'id'), trả về user.id
    // Nếu không truyền, trả về toàn bộ user object
    return data ? user?.[data] : user;
  },
);