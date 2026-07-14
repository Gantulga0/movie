import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CheckoutDto {
  @IsString()
  planId!: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;
}

/** Rental purchase — only the target title; price is server-resolved. */
export class RentDto {
  @IsString()
  contentId!: string;
}
