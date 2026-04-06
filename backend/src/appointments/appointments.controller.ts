import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import {
  createAppointmentSchema,
  updateAppointmentSchema,
} from './appointments.validation';
import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const appointmentExample = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  name: 'Jane Smith',
  email: 'jane.smith@example.com',
  phone: '+447700900000',
  description: 'Annual health check-up',
  date_time: '2026-12-15T10:00:00.000Z',
  status: 'pending',
  metadata: {},
  created_at: '2026-04-06T12:00:00.000Z',
  updated_at: '2026-04-06T12:00:00.000Z',
};

@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new appointment' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'email', 'phone', 'description', 'date_time'],
      properties: {
        name: { type: 'string', example: 'Jane Smith' },
        email: { type: 'string', format: 'email', example: 'jane.smith@example.com' },
        phone: { type: 'string', example: '+447700900000' },
        description: { type: 'string', example: 'Annual health check-up' },
        date_time: { type: 'string', format: 'date-time', example: '2026-12-15T10:00:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Appointment created', schema: { example: appointmentExample } })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async create(@Body() body: unknown) {
    const dto = this.validate(createAppointmentSchema, body);
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all appointments' })
  @ApiResponse({ status: 200, description: 'Array of appointments', schema: { example: [appointmentExample] } })
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an appointment by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'The appointment', schema: { example: appointmentExample } })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async findOne(@Param('id') id: string) {
    this.validateUuid(id);
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update an appointment' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Jane Smith' },
        email: { type: 'string', format: 'email', example: 'jane.smith@example.com' },
        phone: { type: 'string', example: '+447700900000' },
        description: { type: 'string', example: 'Annual health check-up' },
        date_time: { type: 'string', format: 'date-time', example: '2026-12-15T10:00:00.000Z' },
        status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled'] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Updated appointment', schema: { example: appointmentExample } })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async update(@Param('id') id: string, @Body() body: unknown) {
    this.validateUuid(id);
    const dto = this.validate(updateAppointmentSchema, body);
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an appointment' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Appointment deleted' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async remove(@Param('id') id: string) {
    this.validateUuid(id);
    return this.service.remove(id);
  }

  private validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }

  private validateUuid(id: string) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid UUID format');
    }
  }
}
