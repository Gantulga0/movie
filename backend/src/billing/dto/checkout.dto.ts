import { IsString } from 'class-validator';

export class CheckoutDto {
  @IsString()
  planId!: string;
}

/** Rental purchase — only the target title; price is server-resolved. */
export class RentDto {
  @IsString()
  contentId!: string;
}
