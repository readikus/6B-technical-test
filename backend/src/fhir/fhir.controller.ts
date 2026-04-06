import {
  Controller,
  Get,
  Param,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppointmentsService } from '../appointments/appointments.service';
import { FhirMapper } from './fhir.mapper';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fhirAppointmentExample = {
  resourceType: 'Appointment',
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  meta: {
    versionId: '1',
    lastUpdated: '2026-04-06T12:00:00.000Z',
    profile: ['http://hl7.org/fhir/StructureDefinition/Appointment'],
  },
  status: 'proposed',
  description: 'Annual health check-up',
  start: '2026-12-15T10:00:00.000Z',
  created: '2026-04-06T12:00:00.000Z',
  participant: [
    {
      actor: {
        reference: '#patient-a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        display: 'Jane Smith',
      },
      status: 'accepted',
    },
  ],
  contained: [
    {
      resourceType: 'Patient',
      id: 'patient-a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      name: [{ text: 'Jane Smith' }],
      telecom: [
        { system: 'phone', value: '+447700900000' },
        { system: 'email', value: 'jane.smith@example.com' },
      ],
    },
  ],
};

@ApiTags('FHIR R4')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fhir')
export class FhirController {
  private readonly mapper: FhirMapper;

  constructor(private readonly appointmentsService: AppointmentsService) {
    const baseUrl = process.env.BASE_URL ?? 'http://localhost:3001/api';
    this.mapper = new FhirMapper(baseUrl);
  }

  @Get('Appointment')
  @ApiOperation({
    summary: 'List appointments as FHIR R4 Bundle',
    description:
      'Returns all appointments in FHIR R4 searchset Bundle format. Patient PII is embedded as a contained Patient resource within each Appointment.',
  })
  @ApiResponse({
    status: 200,
    description: 'FHIR R4 Bundle (searchset)',
    schema: {
      example: {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [
          {
            fullUrl: 'http://localhost:3001/api/fhir/Appointment/a1b2...',
            resource: fhirAppointmentExample,
          },
        ],
      },
    },
  })
  async findAll() {
    const appointments = await this.appointmentsService.findAll();
    return this.mapper.toFhirBundle(appointments);
  }

  @Get('Appointment/:id')
  @ApiOperation({
    summary: 'Get a single appointment as FHIR R4 Appointment resource',
    description:
      'Returns a single appointment in FHIR R4 format. Status mapping: pending=proposed, confirmed=booked, cancelled=cancelled. Patient details are embedded as a contained resource.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'FHIR R4 Appointment resource',
    schema: { example: fhirAppointmentExample },
  })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async findOne(@Param('id') id: string) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid UUID format');
    }
    const appointment = await this.appointmentsService.findOne(id);
    return this.mapper.toFhirAppointment(appointment);
  }
}
