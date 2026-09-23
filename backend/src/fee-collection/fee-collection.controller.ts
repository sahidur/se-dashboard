import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FeeCollectionService } from './fee-collection.service';
import {
  GenerateFeesDto,
  CollectPaymentDto,
  CancelPaymentDto,
  ListPaymentsQueryDto,
} from './dto/fee-collection.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../auth/guards/access.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Fee Collection')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('fee-collection')
export class FeeCollectionController {
  constructor(private readonly service: FeeCollectionService) {}

  @Post('generate')
  @Permissions({ module: 'fee-collection', action: 'create' })
  @ApiOperation({ summary: 'Generate monthly fee snapshots for active students' })
  generate(@Body() dto: GenerateFeesDto) {
    return this.service.generateFees(dto);
  }

  @Get('monthly')
  @Permissions({ module: 'fee-collection', action: 'read' })
  @ApiOperation({ summary: 'Monthly collection list for a class/section' })
  monthly(
    @Query('schoolId', ParseUUIDPipe) schoolId: string,
    @Query('academicYearId', ParseUUIDPipe) academicYearId: string,
    @Query('month') month: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.service.monthlyCollection(
      schoolId,
      academicYearId,
      parseInt(month, 10),
      classId || undefined,
      sectionId || undefined,
    );
  }

  @Post('payments')
  @Permissions({ module: 'fee-collection', action: 'create' })
  @ApiOperation({ summary: 'Collect a payment (full or partial) and issue a receipt' })
  collect(
    @Body() dto: CollectPaymentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.collectPayment(dto, userId);
  }

  @Get('payments')
  @Permissions({ module: 'fee-collection', action: 'read' })
  @ApiOperation({ summary: 'Payment history' })
  listPayments(@Query() query: ListPaymentsQueryDto) {
    return this.service.listPayments(query);
  }

  @Post('payments/:id/cancel')
  @Permissions({ module: 'fee-collection', action: 'delete' })
  @ApiOperation({ summary: 'Cancel a payment (void receipt, roll back paid amount)' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelPaymentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.cancelPayment(id, dto.reason, userId);
  }

  @Get('payments/:id/receipt')
  @Permissions({ module: 'fee-collection', action: 'read' })
  @ApiOperation({ summary: 'Receipt details for reprint' })
  receipt(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findReceipt(id);
  }

  @Get('receipts')
  @Permissions({ module: 'fee-collection', action: 'read' })
  @ApiOperation({ summary: 'Search receipts of a school' })
  receipts(
    @Query('schoolId', ParseUUIDPipe) schoolId: string,
    @Query('search') search?: string,
  ) {
    return this.service.findReceipts(schoolId, search);
  }

  @Get('students/:id/dues')
  @Permissions({ module: 'fee-collection', action: 'read' })
  @ApiOperation({ summary: 'Month-wise dues of a student (origin month preserved)' })
  dues(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.studentDues(id);
  }

  @Get('students/:id/dues-by-head')
  @Permissions({ module: 'fee-collection', action: 'read' })
  @ApiOperation({ summary: 'Head-wise dues of a student per month (for the dues detail modal)' })
  duesByHead(@Param('id', ParseUUIDPipe) id: string, @Query('academicYearId') academicYearId?: string) {
    return this.service.studentDuesByHead(id, academicYearId || undefined);
  }

  @Get('students/:id/fee-summary')
  @Permissions({ module: 'fee-collection', action: 'read' })
  @ApiOperation({ summary: 'Fee summary + month ledger of a student' })
  summary(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.studentFeeSummary(id);
  }
}
