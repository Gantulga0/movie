import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ActivityService } from './activity.service';
import { UpsertHistoryDto, UpsertRatingDto } from './dto/activity.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../users/users.service';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get('watchlist')
  watchlist(@CurrentUser() user: SafeUser) {
    return this.activity.getWatchlist(user.id);
  }

  @Post('watchlist/:contentId')
  addWatchlist(@CurrentUser() user: SafeUser, @Param('contentId') contentId: string) {
    return this.activity.addToWatchlist(user.id, contentId);
  }

  @Delete('watchlist/:contentId')
  removeWatchlist(
    @CurrentUser() user: SafeUser,
    @Param('contentId') contentId: string,
  ) {
    return this.activity.removeFromWatchlist(user.id, contentId);
  }

  @Get('history')
  history(@CurrentUser() user: SafeUser) {
    return this.activity.getHistory(user.id);
  }

  @Put('history')
  upsertHistory(@CurrentUser() user: SafeUser, @Body() dto: UpsertHistoryDto) {
    return this.activity.upsertHistory(user.id, dto);
  }

  @Delete('history/:contentId')
  removeHistory(
    @CurrentUser() user: SafeUser,
    @Param('contentId') contentId: string,
  ) {
    return this.activity.removeHistory(user.id, contentId);
  }

  @Put('ratings')
  upsertRating(@CurrentUser() user: SafeUser, @Body() dto: UpsertRatingDto) {
    return this.activity.upsertRating(user.id, dto);
  }

  @Delete('ratings/:contentId')
  removeRating(
    @CurrentUser() user: SafeUser,
    @Param('contentId') contentId: string,
  ) {
    return this.activity.removeRating(user.id, contentId);
  }
}
